import { soonestSchedule } from 'lineup-contract'
import { useEffect, useMemo, useState } from 'react'

import { imagesOf } from '@/features/planner/board'
import { boardStore, usePlanner } from '@/features/planner/planner'

import { fromFieldTime } from './post-time'
import { spacingFor } from './publish-timing'

// ~keep
// Sizes are read from the stored publish copies, only for the cells whose gap depends on them
// (those with a video), so a board of pictures reads nothing. A copy that is gone leaves its
// size unknown, which asks for the base gap.
function useSizes(cell: string) {
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const wanted = usePlanner(({ board, images }) =>
    Object.keys(board.posts ?? {})
      .concat(cell)
      .flatMap((held) => {
        const inside = imagesOf(board, held)
        return inside.some((image) => images[image]?.video) ? inside : []
      })
      .join('\n')
  )
  useEffect(() => {
    let current = true
    const missing = wanted.split('\n').filter((image) => image && !(image in sizes))
    if (missing.length === 0) return
    void Promise.all(missing.map((image) => boardStore.getPublishCopy(image))).then((copies) => {
      if (!current) return
      setSizes((known) => ({
        ...known,
        ...Object.fromEntries(missing.map((image, index) => [image, copies[index]?.size ?? 0]))
      }))
    })
    return () => {
      current = false
    }
  }, [wanted, sizes])
  return sizes
}

export function useSpacing(cell: string, when: string) {
  const sizes = useSizes(cell)
  const board = usePlanner(({ board }) => board)
  const images = usePlanner(({ images }) => images)
  return useMemo(() => {
    const at = Date.parse(when)
    if (Number.isNaN(at)) return undefined
    const time = Date.parse(fromFieldTime(when))
    const soonest = soonestSchedule().getTime()
    if (time < soonest) return undefined
    return spacingFor({ board, images, sizes, cell, when: time, soonest })
  }, [board, images, sizes, cell, when])
}
