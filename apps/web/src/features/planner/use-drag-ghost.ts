import {
  animate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity
} from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { type Box, centreOf, type Point } from './drag-target'
import { settle } from './motion'
import { instagram } from './network-profile'

const { width, height } = instagram.cellRatio

export const GHOST_WIDTH = 192
export const GHOST_HEIGHT = (GHOST_WIDTH * height) / width

const GHOST_OPACITY = 0.65
// On a phone the full size would cover most of the grid.
const MAX_VIEWPORT_SHARE = 0.4
const MAX_LEAN_DEGREES = 10
// The pointer speed, in px/s, at which the ghost reaches its full lean.
const FULL_LEAN_SPEED = 1600
const LEAN_SPRING = { stiffness: 320, damping: 24, mass: 0.6 }

const restingScale = () => Math.min(1, (window.innerWidth * MAX_VIEWPORT_SHARE) / GHOST_WIDTH)

/**
 * One element from pick-up to landing, so nothing is handed over at the moment of a drop. It sits at
 * the pointer plus an offset: the offset is what lifts it off a cell and lands it on one, which
 * leaves the pointer's speed, and so the lean, to the pointer alone.
 */
export function useDragGhost() {
  const reduced = useReducedMotion()
  const [id, setId] = useState<string | null>(null)

  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(0)
  const leaning = useMotionValue(1)

  const x = useTransform(() => pointerX.get() + offsetX.get())
  const y = useTransform(() => pointerY.get() + offsetY.get())
  const lean = useTransform(
    useVelocity(pointerX),
    [-FULL_LEAN_SPEED, FULL_LEAN_SPEED],
    [-MAX_LEAN_DEGREES, MAX_LEAN_DEGREES]
  )
  const rotate = useSpring(
    useTransform(() => lean.get() * leaning.get()),
    LEAN_SPRING
  )

  const landed = useRef<(() => void) | null>(null)

  /** A new drag can start before a landing has finished. */
  const finishLanding = useCallback(() => {
    const done = landed.current
    landed.current = null
    done?.()
  }, [])

  const lift = useCallback(
    (cell: string, pointer: Point, from: Box) => {
      finishLanding()
      const start = centreOf(from)
      pointerX.jump(pointer.x)
      pointerY.jump(pointer.y)
      offsetX.jump(start.x - pointer.x)
      offsetY.jump(start.y - pointer.y)
      scale.jump((from.right - from.left) / GHOST_WIDTH)
      opacity.jump(1)
      leaning.jump(1)
      setId(cell)
      animate(offsetX, 0, settle)
      animate(offsetY, 0, settle)
      animate(scale, restingScale(), settle)
      animate(opacity, GHOST_OPACITY, { duration: 0.15 })
    },
    [finishLanding, leaning, offsetX, offsetY, opacity, pointerX, pointerY, scale]
  )

  const follow = useCallback(
    ({ x, y }: Point) => {
      pointerX.set(x)
      pointerY.set(y)
    },
    [pointerX, pointerY]
  )

  /** A key press jumps from cell to cell, so the ghost travels there instead. */
  const glide = useCallback(
    ({ x, y }: Point) => {
      animate(pointerX, x, settle)
      animate(pointerY, y, settle)
    },
    [pointerX, pointerY]
  )

  const land = useCallback(
    (to: Box | undefined, done: () => void) => {
      const clear = () => {
        setId(null)
        opacity.jump(0)
        done()
      }
      if (!to || reduced) {
        clear()
        return
      }
      const end = centreOf(to)
      leaning.set(0)
      landed.current = clear
      void Promise.all([
        animate(offsetX, end.x - pointerX.get(), settle),
        animate(offsetY, end.y - pointerY.get(), settle),
        animate(scale, (to.right - to.left) / GHOST_WIDTH, settle),
        animate(opacity, 1, { duration: 0.15 })
      ]).then(() => {
        if (landed.current !== clear) return
        landed.current = null
        clear()
      })
    },
    [leaning, offsetX, offsetY, opacity, pointerX, pointerY, reduced, scale]
  )

  return useMemo(
    () => ({ id, x, y, rotate, scale, opacity, lift, follow, glide, land }),
    [id, x, y, rotate, scale, opacity, lift, follow, glide, land]
  )
}

export type DragGhostState = ReturnType<typeof useDragGhost>
