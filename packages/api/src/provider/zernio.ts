import type { PostStatus, ScheduledPost } from 'lineup-contract'
import { z } from 'zod'

import { type Provider, ProviderError, type ProviderFailure } from './provider'

const BASE_URL = 'https://zernio.com/api/v1'
const PLATFORM = 'instagram'
const TIMEOUT_MS = 15_000
const RECENT_POSTS = 30
const SCHEDULED_POSTS = 100
// Every group but the two that hold what Lineup calls. A key made with this can manage no keys.
const UNUSED_GROUPS = [
  'engagement',
  'messages',
  'contacts',
  'analytics',
  'ads',
  'telephony',
  'billing',
  'webhooks',
  'commerce',
  'creator_campaigns',
  'money',
  'calendar',
  'files'
]
// Stories and ads are not on the grid.
const OFF_THE_GRID = ['STORY', 'AD']

const failures: Record<number, ProviderFailure> = {
  400: 'refused',
  401: 'key',
  403: 'forbidden',
  404: 'missing',
  409: 'busy',
  422: 'refused',
  429: 'limited'
}

const errorSchema = z.object({ error: z.string().optional() })

const zernioPostSchema = z.object({
  _id: z.string(),
  content: z.string().optional(),
  status: z.string(),
  scheduledFor: z.string().optional(),
  timezone: z.string().optional(),
  mediaItems: z.array(z.object({ url: z.string().optional() })).optional(),
  platforms: z
    .array(
      z.object({
        platformPostUrl: z.string().nullish(),
        publishedAt: z.string().nullish(),
        errorMessage: z.string().nullish()
      })
    )
    .optional()
})
type ZernioPost = z.infer<typeof zernioPostSchema>

const statuses: Record<string, PostStatus> = {
  draft: 'scheduled',
  pending_approval: 'scheduled',
  scheduled: 'scheduled',
  publishing: 'publishing',
  published: 'published',
  // One platform on every post, so a partial one has failed on the only one it has.
  partial: 'failed',
  failed: 'failed',
  cancelled: 'cancelled'
}

function toScheduledPost(post: ZernioPost): ScheduledPost {
  const [target] = post.platforms ?? []
  return {
    id: post._id,
    status: statuses[post.status] ?? 'scheduled',
    scheduledFor: post.scheduledFor,
    timeZone: post.timezone,
    caption: post.content,
    url: target?.platformPostUrl ?? undefined,
    failure: target?.errorMessage ?? undefined
  }
}

const profilesSchema = z.object({
  profiles: z.array(z.object({ _id: z.string(), name: z.string() }))
})
const accountsSchema = z.object({
  accounts: z.array(
    z.object({
      _id: z.string(),
      platform: z.string(),
      username: z.string().optional(),
      displayName: z.string().optional(),
      profilePicture: z.string().nullish(),
      isActive: z.boolean(),
      needsReconnection: z.boolean().optional()
    })
  )
})
const externalPostsSchema = z.object({
  posts: z.array(
    z.object({
      platformPostId: z.string(),
      platformPostUrl: z.string().optional(),
      content: z.string().optional(),
      publishedAt: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      mediaProductType: z.string().optional()
    })
  )
})
const postsSchema = z.object({ posts: z.array(zernioPostSchema) })
const postSchema = z.object({ post: zernioPostSchema })
const createdKeySchema = z.object({ apiKey: z.object({ key: z.string() }) })
const presignSchema = z.object({ uploadUrl: z.string(), publicUrl: z.string() })
const connectSchema = z.object({ authUrl: z.string() })
const nothing = z.unknown()

async function failureOf(response: Response) {
  const retryAfter = Number(response.headers.get('Retry-After')) || undefined
  const body = errorSchema.safeParse(await response.json().catch(() => undefined))
  const failure = failures[response.status] ?? 'down'
  return new ProviderError(failure, { detail: body.data?.error, retryAfter })
}

export function zernio(key: string): Provider {
  async function call<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    { body, headers, method }: { body?: unknown; headers?: HeadersInit; method?: string } = {}
  ): Promise<z.output<Schema>> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }).catch(() => {
      throw new ProviderError('down')
    })
    if (!response.ok) throw await failureOf(response)
    if (response.status === 204) return schema.parse(undefined)
    const parsed = schema.safeParse(await response.json().catch(() => undefined))
    // An answer of a shape nobody expected has to fail here, not somewhere it cannot be explained.
    if (!parsed.success) throw new ProviderError('down')
    return parsed.data
  }

  return {
    async profiles() {
      const { profiles } = await call('/profiles', profilesSchema)
      return profiles.map(({ _id, name }) => ({ id: _id, name }))
    },

    async narrowed(profileId, days) {
      const body = {
        name: 'Lineup',
        scope: 'profiles',
        profileIds: [profileId],
        expiresIn: days,
        disabledResourceGroups: UNUSED_GROUPS
      }
      try {
        const { apiKey } = await call('/api-keys', createdKeySchema, { method: 'POST', body })
        return apiKey.key
      } catch (error) {
        // A narrow key cannot make another, and that is the key the guide asks for.
        if (error instanceof ProviderError && ['forbidden', 'refused'].includes(error.failure)) {
          return undefined
        }
        throw error
      }
    },

    async accounts(profileId) {
      const query = new URLSearchParams({ profileId })
      const { accounts } = await call(`/accounts?${query}`, accountsSchema)
      return accounts
        .filter(({ platform, isActive }) => platform === PLATFORM && isActive)
        .map(({ _id, username, displayName, profilePicture, needsReconnection }) => ({
          id: _id,
          username: username ?? displayName ?? _id,
          displayName,
          avatarUrl: profilePicture ?? undefined,
          needsReconnection: needsReconnection ?? false
        }))
    },

    async connectUrl(profileId, returnTo) {
      const query = new URLSearchParams({ profileId, redirect_url: returnTo })
      const { authUrl } = await call(`/connect/${PLATFORM}?${query}`, connectSchema)
      return authUrl
    },

    async publishedPosts(accountId) {
      const limit = String(RECENT_POSTS)
      const query = (source: string) => new URLSearchParams({ accountId, limit, source })
      const [{ posts: elsewhere }, { posts: throughHere }] = await Promise.all([
        call(`/posts?${query('external')}`, externalPostsSchema),
        call(`/posts?${query('zernio')}&status=published`, postsSchema)
      ])
      const fromElsewhere = elsewhere
        .filter(({ mediaProductType }) => !OFF_THE_GRID.includes(mediaProductType ?? ''))
        .map((post) => ({
          id: post.platformPostId,
          url: post.platformPostUrl,
          thumbnailUrl: post.thumbnailUrl,
          caption: post.content,
          publishedAt: post.publishedAt
        }))
      const seen = new Set(fromElsewhere.map(({ url }) => url))
      const fromHere = throughHere
        .map((post) => ({
          id: post._id,
          url: post.platforms?.[0]?.platformPostUrl ?? undefined,
          thumbnailUrl: post.mediaItems?.[0]?.url,
          caption: post.content,
          publishedAt: post.platforms?.[0]?.publishedAt ?? undefined
        }))
        .filter(({ url }) => !seen.has(url))
      return [...fromElsewhere, ...fromHere]
        .toSorted((one, other) => (other.publishedAt ?? '').localeCompare(one.publishedAt ?? ''))
        .slice(0, RECENT_POSTS)
    },

    async upload({ fileName, contentType, size }) {
      const body = { filename: fileName, contentType, size }
      const { uploadUrl, publicUrl } = await call('/media/presign', presignSchema, {
        method: 'POST',
        body
      })
      return { uploadUrl, mediaUrl: publicUrl }
    },

    async scheduledPosts(accountId) {
      const query = new URLSearchParams({
        accountId,
        limit: String(SCHEDULED_POSTS),
        sortBy: 'created-desc'
      })
      const { posts } = await call(`/posts?${query}`, postsSchema)
      return posts.map(toScheduledPost)
    },

    async schedule({ accountId, caption, scheduledFor, timeZone, mediaUrls }, idempotencyKey) {
      const { post } = await call('/posts', postSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
          content: caption,
          scheduledFor,
          timezone: timeZone,
          mediaItems: mediaUrls.map((url) => ({ type: 'image', url })),
          platforms: [{ platform: PLATFORM, accountId }]
        }
      })
      return toScheduledPost(post)
    },

    async update(id, { scheduledFor, timeZone, caption }) {
      const { post } = await call(`/posts/${encodeURIComponent(id)}`, postSchema, {
        method: 'PUT',
        body: { scheduledFor, timezone: timeZone, content: caption }
      })
      return toScheduledPost(post)
    },

    async cancel(id) {
      await call(`/posts/${encodeURIComponent(id)}`, nothing, { method: 'DELETE' }).catch(
        (error: unknown) => {
          // Already gone is what was asked for.
          if (!(error instanceof ProviderError && error.failure === 'missing')) throw error
        }
      )
    }
  }
}
