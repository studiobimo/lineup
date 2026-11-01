import { m } from 'motion/react'

import { Thumbnail } from './thumbnail'
import { type DragGhostState, GHOST_HEIGHT, GHOST_WIDTH } from './use-drag-ghost'

export function DragGhost({ ghost }: { ghost: DragGhostState }) {
  const { id, x, y, rotate, scale, opacity } = ghost
  if (!id) return null
  return (
    <m.div
      aria-hidden
      data-ghost
      className="pointer-events-none fixed z-50 overflow-hidden bg-muted shadow-xl will-change-transform"
      style={{
        left: -GHOST_WIDTH / 2,
        top: -GHOST_HEIGHT / 2,
        width: GHOST_WIDTH,
        height: GHOST_HEIGHT,
        x,
        y,
        rotate,
        scale,
        opacity
      }}
    >
      <Thumbnail id={id} label="" />
    </m.div>
  )
}
