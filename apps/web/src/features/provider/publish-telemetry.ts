import type { QueryClient } from '@tanstack/react-query'
import { hc } from 'hono/client'
import type { ApiRoutes } from 'lineup-api'
import {
  accountHandleSchema,
  cleanUsername,
  type PostShape,
  type PublishDelay,
  publishDelaySchema
} from 'lineup-contract'

import type { CellPost } from '@/features/planner/board-schema'
import { plannerStore } from '@/features/planner/planner'

import { accountsQuery } from './queries'

const telemetryApi = hc<ApiRoutes>('/').api.v1.telemetry['publish-delay']

const SECOND = 1000
const appVersion: string = import.meta.env.VITE_APP_VERSION ?? 'dev'

// ~keep ADR-0026. Counts and sizes only. A single video is a reel, which is how Instagram shows it.
export function postShape(
  copies: readonly { type: string; size: number }[],
  durations: readonly (number | undefined)[]
): PostShape {
  const videos = copies.flatMap(({ type, size }, index) =>
    type.startsWith('video/') ? [{ size, seconds: durations[index] }] : []
  )
  const seconds = videos.flatMap((video) => (video.seconds === undefined ? [] : [video.seconds]))
  return {
    kind: copies.length > 1 ? 'carousel' : videos.length ? 'reel' : 'image',
    images: copies.length - videos.length,
    videos: videos.length,
    totalBytes: copies.reduce((total, { size }) => total + size, 0),
    largestVideoBytes: videos.length ? Math.max(...videos.map(({ size }) => size)) : undefined,
    largestVideoSeconds: seconds.length ? Math.max(...seconds) : undefined
  }
}

// ~keep Undefined, and so unsent, when the post has no shape or no time from the provider:
// the moment the app noticed would measure its polling and not the delay.
export function publishDelayEvent(post: CellPost, handle: string | undefined) {
  const { media, scheduledFor, publishedAt } = post
  if (!media || !publishedAt) return undefined
  const delay = (Date.parse(publishedAt) - Date.parse(scheduledFor)) / SECOND
  if (Number.isNaN(delay)) return undefined
  const account = accountHandleSchema.safeParse(handle && cleanUsername(handle))
  const event: PublishDelay = {
    ...media,
    eventId: crypto.randomUUID(),
    scheduledFor,
    publishedAt,
    delaySeconds: Math.max(0, Math.round(delay)),
    appVersion,
    ...(account.success && { account: account.data })
  }
  return publishDelaySchema.safeParse(event).data
}

// ~keep Fire and forget, and at most once: a post is marked before it is sent, and the sync drops
// its cell right after, so a reload never sends it again. A failed send is not retried.
export function reportPublished(cells: string[], queryClient: QueryClient, accountId: string) {
  try {
    const { board, updatePosts } = plannerStore.getState()
    const due = cells.flatMap((cell) => {
      const post = board.posts?.[cell]
      return post?.status === 'published' && !post.reported ? [{ cell, post }] : []
    })
    if (due.length === 0) return
    updatePosts(
      Object.fromEntries(due.map(({ cell, post }) => [cell, { ...post, reported: true }]))
    )
    // ~keep Read after the accounts are, which a fresh load may not have yet. Sending does not
    // hold up dropping the cell.
    void queryClient
      .ensureQueryData(accountsQuery)
      .catch(() => undefined)
      .then((accounts) => {
        const handle = accounts?.find(({ id }) => id === accountId)?.username
        for (const { post } of due) {
          const event = publishDelayEvent(post, handle)
          if (event) void telemetryApi.$post({ json: event }).catch(() => undefined)
        }
      })
  } catch {
    // ~keep
    // Never reaches the person: this only measures.
  }
}
