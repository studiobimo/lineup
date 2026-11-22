import type { PublishedPost } from 'lineup-contract'
import { useStore } from 'zustand'
import { z } from 'zod'

import { plannerStore } from '@/features/planner/planner'
import { createStoredStore } from '@/lib/stored-store'

// ~keep
// Only ids and times are kept, never a caption or a picture. The ids are the provider's, so the
// dialog can find each post's thumbnail in the published list while that list still holds it.
const timedSchema = z.object({
  id: z.string(),
  scheduledFor: z.string(),
  publishedAt: z.string()
})
export type Timed = z.infer<typeof timedSchema>

const noticeSchema = z.object({
  // ~keep
  // Scheduled first, but live after the other.
  first: timedSchema,
  second: timedSchema
})
export type OrderNotice = z.infer<typeof noticeSchema>

const rememberedSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  scheduledFor: z.string()
})
type Remembered = z.infer<typeof rememberedSchema>

const REMEMBERED = 20
const SEEN = 50

export const noticeKey = ({ first, second }: OrderNotice) => `${first.id}|${second.id}`

// ~keep
// This lives in local storage beside the other device settings, not in the board: it is not part
// of what is planned, so it takes no migration and is not in the history or a backup, and a
// missing or damaged value is just no notice. `recent` holds the posts that have gone live, since
// a published cell leaves the board (ADR-0024) and the other half of a swap may come a poll later.
const { store, save } = createStoredStore<{
  recent: Remembered[]
  notices: OrderNotice[]
  seen: string[]
}>('order-notice', ({ recent, notices, seen }) => ({
  recent: z.array(rememberedSchema).catch([]).parse(recent),
  notices: z.array(noticeSchema).catch([]).parse(notices),
  seen: z.array(z.string()).catch([]).parse(seen)
}))

export const orderNoticeStore = store

export const useOrderNotices = () => useStore(store, ({ notices }) => notices)

export function findSwaps(posts: Remembered[], published: PublishedPost[]): OrderNotice[] {
  const byId = new Map(published.map((post) => [post.id, post]))
  const byUrl = new Map(published.flatMap((post) => (post.url ? [[post.url, post] as const] : [])))
  const live = posts
    .flatMap(({ id, url, scheduledFor }) => {
      const post = byId.get(id) ?? (url ? byUrl.get(url) : undefined)
      return post?.publishedAt ? [{ id: post.id, scheduledFor, publishedAt: post.publishedAt }] : []
    })
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor))
  const swaps: OrderNotice[] = []
  live.forEach((first, index) => {
    for (const second of live.slice(index + 1)) {
      const planned = Date.parse(first.scheduledFor) < Date.parse(second.scheduledFor)
      if (planned && Date.parse(first.publishedAt) > Date.parse(second.publishedAt)) {
        swaps.push({ first, second })
      }
    }
  })
  return swaps
}

// ~keep
// Called as published cells are about to leave the board, with the provider's list just read.
export function noteOrder(cells: string[], published: PublishedPost[]) {
  const posts = plannerStore.getState().board.posts ?? {}
  const gone = cells.flatMap((cell) =>
    posts[cell]
      ? [{ id: posts[cell].id, url: posts[cell].url, scheduledFor: posts[cell].scheduledFor }]
      : []
  )
  const { recent, notices, seen } = store.getState()
  const known = new Set(gone.map(({ id }) => id))
  const tracked = [...recent.filter(({ id }) => !known.has(id)), ...gone]
  const reported = new Set([...seen, ...notices.map(noticeKey)])
  const fresh = findSwaps(tracked, published).filter((swap) => !reported.has(noticeKey(swap)))
  save({ recent: tracked.slice(-REMEMBERED), notices: [...notices, ...fresh] })
}

export function dismissNotices() {
  const { notices, seen } = store.getState()
  save({ notices: [], seen: [...seen, ...notices.map(noticeKey)].slice(-SEEN) })
}
