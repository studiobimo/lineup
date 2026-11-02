import { useQuery } from '@tanstack/react-query'
import type { ScheduledPost } from 'lineup-contract'
import { useEffect } from 'react'

import type { CellPost } from '@/features/planner/board-schema'
import type { Board } from '@/features/planner/board-store'
import { plannerStore, usePlanner } from '@/features/planner/planner'

import { postsQuery } from './queries'

/** What the provider says of each cell's post. One it no longer lists stays as it was (ADR-0018). */
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

/** Keeps the board's posts up to date, with no request while it has none. */
export function usePostSync(accountId: string) {
  const tracking = usePlanner(({ board }) => Object.keys(board.posts ?? {}).length > 0)
  const { data: latest } = useQuery({ ...postsQuery(accountId), enabled: tracking })
  useEffect(() => {
    if (!latest) return
    const { board, updatePosts } = plannerStore.getState()
    updatePosts(postChanges(board, latest))
  }, [latest])
}
