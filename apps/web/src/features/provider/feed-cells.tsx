import type { PublishedPost } from 'lineup-contract'
import type { ReactNode } from 'react'

import { plannedCells } from '@/features/planner/board'
import { BoardCell } from '@/features/planner/board-cell'
import { useTabStopCell } from '@/features/planner/use-planned-cells'
import { usePlanner } from '@/features/planner/planner'

import type { FeedEntry } from './published-order'
import { usePublishedFeed } from './use-published-feed'

interface FeedCellsProps {
  feed: FeedEntry[]
  post?: (post: PublishedPost, position: number) => ReactNode
}

// The planner draws the planned cells first, so the feed takes the places after them. ~keep
export function FeedCells({ feed, post }: FeedCellsProps) {
  const planned = usePlanner(({ board }) => plannedCells(board).length)
  const tabStop = useTabStopCell('grid')
  return feed.map((entry, index) =>
    'cell' in entry ? (
      <BoardCell
        key={entry.cell}
        id={entry.cell}
        container="grid"
        position={planned + index + 1}
        tabStop={entry.cell === tabStop}
      />
    ) : (
      post?.(entry.post, planned + index + 1)
    )
  )
}

// What the board itself knows of its published cells, which needs no connection. ~keep
export function StoredCells() {
  return <FeedCells feed={usePublishedFeed(undefined)} />
}
