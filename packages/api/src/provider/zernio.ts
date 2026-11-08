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
  content: z.string().nullish(),
  status: z.string(),
  scheduledFor: z.string().nullish(),
  timezone: z.string().nullish(),
  mediaProductType: z.string().nullish(),
  mediaItems: z
    .array(
      z.object({
        type: z.string().nullish(),
        url: z.string().nullish(),
        thumbnail: z.string().nullish(),
        instagramThumbnail: z.string().nullish()
      })
    )
    .nullish(),
  platforms: z
    .array(
      z.object({
        platformPostId: z.string().nullish(),
        platformPostUrl: z.string().nullish(),
        publishedAt: z.string().nullish(),
        errorMessage: z.string().nullish()
      })
    )
    .nullish()
})
type ZernioPost = z.infer<typeof zernioPostSchema>

const VIDEO_FILE = /\.(mp4|mov|m4v)(\?|#|$)/i

type ZernioMedia = NonNullable<ZernioPost['mediaItems']>[number]

const isVideo = (media: ZernioMedia | undefined) =>
  media?.type === 'video' || VIDEO_FILE.test(media?.url ?? '')

// A video's url is the video, which an <img> cannot show, and Zernio often sends no thumbnail.
function toPublishedPost(post: ZernioPost, id: string) {
  const [target] = post.platforms ?? []
  const [media] = post.mediaItems ?? []
  const video = isVideo(media)
  const picture = media?.thumbnail ?? media?.instagramThumbnail
  return {
    id,
    url: target?.platformPostUrl ?? undefined,
    thumbnailUrl: picture ?? (video ? undefined : media?.url) ?? undefined,
    videoUrl: (video && media?.url) || undefined,
    caption: post.content ?? undefined,
    publishedAt: target?.publishedAt ?? post.scheduledFor ?? undefined
  }
}

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
    scheduledFor: post.scheduledFor ?? undefined,
    timeZone: post.timezone ?? undefined,
    caption: post.content ?? undefined,
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
      username: z.string().nullish(),
      displayName: z.string().nullish(),
      profilePicture: z.string().nullish(),
      followersCount: z.number().nullish(),
      isActive: z.boolean(),
      needsReconnection: z.boolean().nullish()
    })
  )
})
const postsSchema = z.object({ posts: z.array(zernioPostSchema) })
const postSchema = z.object({ post: zernioPostSchema })
const createdKeySchema = z.object({ apiKey: z.object({ key: z.string() }) })
const refusedThis = (error: unknown, failures: ProviderFailure[]) =>
  error instanceof ProviderError && failures.includes(error.failure)

const presignSchema = z.object({ uploadUrl: z.string(), publicUrl: z.string() })
const connectSchema = z.object({ authUrl: z.string() })
const nothing = z.unknown()

async function failureOf(response: Response) {
  const retryAfter = Number(response.headers.get('Retry-After')) || undefined
  const body = errorSchema.safeParse(await response.json().catch(() => undefined))
  const failure = failures[response.status] ?? 'down'
  return new ProviderError(failure, { detail: body.data?.error, retryAfter })
}

const at = (value: unknown, path: PropertyKey[]) =>
  path.reduce<unknown>(
    (node, step) =>
      node !== null && typeof node === 'object' ? Reflect.get(node, step) : undefined,
    value
  )
const kindOf = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

// Types and field names only, never a value, so the log holds nothing from the account.
function shapeOf(error: z.ZodError, body: unknown) {
  const issues = error.issues.slice(0, 5)
  const holder = issues[0] && at(body, issues[0].path.slice(0, -1))
  return {
    shape: issues.map(({ path, code }) => `${path.join('.')}:${code}:${kindOf(at(body, path))}`),
    fields: holder !== null && typeof holder === 'object' ? Object.keys(holder).sort() : undefined
  }
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
    }).catch((error: unknown) => {
      console.error(
        JSON.stringify({ provider: 'zernio', where: path.split('?')[0], network: String(error) })
      )
      throw new ProviderError('down')
    })
    const where = path.split('?')[0]
    if (!response.ok) {
      const error = await failureOf(response)
      if (error.failure === 'down')
        console.error(JSON.stringify({ provider: 'zernio', where, status: response.status }))
      throw error
    }
    if (response.status === 204) return schema.parse(undefined)
    const answer: unknown = await response.json().catch(() => undefined)
    const parsed = schema.safeParse(answer)
    // An answer of a shape nobody expected has to fail here, not somewhere it cannot be explained.
    if (!parsed.success) {
      console.error(JSON.stringify({ provider: 'zernio', where, ...shapeOf(parsed.error, answer) }))
      throw new ProviderError('down')
    }
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
        // A narrow key cannot make another, and that is the key the guide asks for. Nor can a
        // read-only key, and this key has just read the profiles, so it is not a bad key.
        if (refusedThis(error, ['forbidden', 'refused', 'key'])) return undefined
        throw error
      }
    },

    async canPost() {
      // An upload URL leaves nothing behind unless something is uploaded to it. Zernio has no way
      // to ask a key what it may do, and limits a read-only key to GET requests.
      const body = { filename: 'lineup-check.jpg', contentType: 'image/jpeg', size: 1 }
      try {
        await call('/media/presign', presignSchema, { method: 'POST', body })
        return true
      } catch (error) {
        if (refusedThis(error, ['forbidden', 'key'])) return false
        throw error
      }
    },

    async accounts(profileId) {
      const query = new URLSearchParams({ profileId })
      const { accounts } = await call(`/accounts?${query}`, accountsSchema)
      return accounts
        .filter(({ platform, isActive }) => platform === PLATFORM && isActive)
        .map((account) => ({
          id: account._id,
          username: account.username ?? account.displayName ?? account._id,
          displayName: account.displayName ?? undefined,
          avatarUrl: account.profilePicture ?? undefined,
          followers: account.followersCount ?? undefined,
          needsReconnection: account.needsReconnection ?? false
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
      // Zernio documents posts from elsewhere in another shape, but sends them in this one.
      const [{ posts: elsewhere }, { posts: throughHere }] = await Promise.all([
        call(`/posts?${query('external')}`, postsSchema),
        call(`/posts?${query('zernio')}&status=published`, postsSchema)
      ])
      const fromElsewhere = elsewhere
        .filter(({ mediaProductType }) => !OFF_THE_GRID.includes(mediaProductType ?? ''))
        .map((post) => toPublishedPost(post, post.platforms?.[0]?.platformPostId ?? post._id))
      // Zernio syncs its own posts back as external ones, with the id or the link maybe missing.
      const seen = new Set(fromElsewhere.flatMap(({ id, url }) => (url ? [id, url] : [id])))
      const fromHere = throughHere
        .filter(({ platforms }) => {
          const target = platforms?.[0]
          return ![target?.platformPostId, target?.platformPostUrl].some(
            (key) => key && seen.has(key)
          )
        })
        .map((post) => toPublishedPost(post, post._id))
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

    async schedule(
      { accountId, caption, scheduledFor, timeZone, mediaUrls, mediaTypes },
      idempotencyKey
    ) {
      const { post } = await call('/posts', postSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
          content: caption,
          scheduledFor,
          timezone: timeZone,
          // Instagram posts a lone video as a Reel, shown on the grid unless told otherwise.
          mediaItems: mediaUrls.map((url, index) => ({
            type: mediaTypes?.[index] ?? 'image',
            url
          })),
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
