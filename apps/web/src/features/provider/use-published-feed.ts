import type { PublishedPost } from 'lineup-contract'
import { useMemo } from 'react'

import { publishedCells, publishedTime } from '@/features/planner/board'
import { usePlanner } from '@/features/planner/planner'

import { type FeedEntry, feedOrder } from './published-order'

// Everything published, newest first: the board's own published cells among the provider's ~keep
// posts. With no connection the cells still show, in the order their stored time gives.
export function usePublishedFeed(remote: PublishedPost[] | undefined): FeedEntry[] {
  const grid = usePlanner(({ board }) => board.grid)
  const linked = usePlanner(({ board }) => board.posts)
  return useMemo(() => {
    const board = { tray: [], grid, posts: linked }
    const cells = publishedCells(board).map((id) => ({
      id,
      at: publishedTime(board, id)
    }))
    return feedOrder(cells, remote ?? [])
  }, [grid, linked, remote])
}
