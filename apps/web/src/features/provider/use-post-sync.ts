import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ScheduledPost } from 'lineup-contract'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'

import type { CellPost } from '@/features/planner/board-schema'
import type { Board } from '@/features/planner/board-store'
import { publishedCells } from '@/features/planner/board'
import { plannerStore, usePlanner } from '@/features/planner/planner'

import { noteOrder } from './order-notice'
import { reportPublished } from './publish-telemetry'
import { postsQuery, publishedQuery } from './queries'

export function postChanges(board: Board, latest: ScheduledPost[]) {
  const byId = new Map(latest.map((post) => [post.id, post]))
  const changes: Record<string, CellPost | undefined> = {}
  for (const [cell, post] of Object.entries(board.posts ?? {})) {
    const fresh = byId.get(post.id)
    if (!fresh) continue
    const cancelled = fresh.status === 'cancelled'
    changes[cell] = cancelled ? undefined : { ...post, ...fresh, failure: fresh.failure }
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
  useEffect(() => {
    if (!latest) return
    const { board, updatePosts } = plannerStore.getState()
    const changes = postChanges(board, latest)
    // ~keep
    // Under StrictMode this runs twice; the second pass finds the board already updated,
    // so it has nothing to announce.
    const notices = postNotices(board, changes)
    updatePosts(changes)
    for (const { kind, post } of notices) {
      if (kind === 'published') {
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
  }, [latest, t])

  const published = usePlanner(({ board }) => publishedCells(board).join('\n'))
  const settling = useRef(new Set<string>())
  useEffect(() => {
    // ~keep
    // A published cell is dropped only once the provider's list has been read again, so the
    // post is never missing in between. A failed read leaves the cell, and the next sync tries
    // again. This also cleans a board saved while published cells stayed on it (ADR-0024).
    const cells = published.split('\n').filter((cell) => cell && !settling.current.has(cell))
    if (cells.length === 0) return
    for (const cell of cells) settling.current.add(cell)
    queryClient
      .fetchQuery({ ...publishedQuery(accountId), staleTime: 0 })
      .then((list) => {
        noteOrder(cells, list)
        reportPublished(cells, queryClient, accountId)
        plannerStore.getState().dropPublished(cells)
      })
      .catch(() => undefined)
      .finally(() => {
        for (const cell of cells) settling.current.delete(cell)
      })
  }, [published, latest, accountId, queryClient])
}
