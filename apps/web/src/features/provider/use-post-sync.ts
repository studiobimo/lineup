import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublishedPost, ScheduledPost } from 'lineup-contract'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'

import type { CellPost } from '@/features/planner/board-schema'
import type { Board } from '@/features/planner/board-store'
import { plannerStore, usePlanner } from '@/features/planner/planner'

import { PROVIDER_KEY, postsQuery, publishedQuery } from './queries'

// The time a published post went out, which orders it among the others, comes from the provider's ~keep
// list of published posts and is kept so the board can place it with no connection.
function publishedAt(post: CellPost, published: PublishedPost[]) {
  const url = post.url
  const match = published.find((other) => other.id === post.id || (url && other.url === url))
  return match?.publishedAt ?? post.publishedAt
}

export function postChanges(
  board: Board,
  latest: ScheduledPost[],
  published: PublishedPost[] = []
) {
  const byId = new Map(latest.map((post) => [post.id, post]))
  const changes: Record<string, CellPost | undefined> = {}
  for (const [cell, post] of Object.entries(board.posts ?? {})) {
    const fresh = byId.get(post.id)
    if (!fresh) continue
    const cancelled = fresh.status === 'cancelled'
    if (cancelled) {
      changes[cell] = undefined
      continue
    }
    const next = { ...post, ...fresh, failure: fresh.failure }
    changes[cell] =
      next.status === 'published' ? { ...next, publishedAt: publishedAt(next, published) } : next
  }
  return changes
}

const SECOND = 1000
const WATCHING = 10 * SECOND
const IDLE = 60 * SECOND

// ~keep
// A post is due once its time has passed: the provider flips it to publishing a moment later,
// so polling quickly from then on is what lets a cell change without a reload.
export function pollInterval(posts: Board['posts'], now = Date.now()) {
  const waiting = Object.values(posts ?? {}).some(
    ({ status, scheduledFor }) =>
      status === 'publishing' || (status === 'scheduled' && Date.parse(scheduledFor) <= now)
  )
  return waiting ? WATCHING : IDLE
}

type PostNotice = { kind: 'published' | 'failed'; post: CellPost }

// ~keep
// Only a change from a status this board already held counts, so a post that was published
// before the board loaded says nothing.
export function postNotices(board: Board, changes: Record<string, CellPost | undefined>) {
  const notices: PostNotice[] = []
  for (const [cell, next] of Object.entries(changes)) {
    const before = board.posts?.[cell]
    if (!before || !next || before.status === next.status) continue
    if (next.status === 'published' || next.status === 'failed') {
      notices.push({ kind: next.status, post: next })
    }
  }
  return notices
}

export function usePostSync(accountId: string) {
  const { t } = useTranslation('provider')
  const queryClient = useQueryClient()
  const tracking = usePlanner(({ board }) => Object.keys(board.posts ?? {}).length > 0)
  const { data: latest } = useQuery({
    ...postsQuery(accountId),
    enabled: tracking,
    // ~keep
    // Read at each tick, so it follows the board without resubscribing.
    refetchInterval: () => pollInterval(plannerStore.getState().board.posts)
  })
  const { data: published } = useQuery({ ...publishedQuery(accountId), enabled: tracking })
  useEffect(() => {
    if (!latest) return
    const { board, updatePosts } = plannerStore.getState()
    const changes = postChanges(board, latest, published)
    // ~keep
    // Under StrictMode this runs twice; the second pass finds the board already updated,
    // so it has nothing to announce.
    const notices = postNotices(board, changes)
    updatePosts(changes)
    for (const { kind, post } of notices) {
      if (kind === 'published') {
        void queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY, 'published', accountId] })
        toastManager.add({
          type: 'success',
          title: t('post.live.published'),
          actionProps: post.url
            ? {
                children: t('post.live.view'),
                onClick: () => window.open(post.url, '_blank', 'noopener')
              }
            : undefined
        })
      } else {
        toastManager.add({
          type: 'error',
          title: t('post.live.failed'),
          description: post.failure
        })
      }
    }
  }, [latest, published, accountId, queryClient, t])
}
