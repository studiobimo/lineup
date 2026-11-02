import { animate, useMotionValue } from 'motion/react'
import { useEffect, useState, type WheelEvent } from 'react'

import { settle } from './motion'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1
const WHEEL_SPEED = 0.002
// A key looks this far, in pixels, one way across the picture, which moves the other way.
const PAN_STEP = 80
const PANS: Record<string, { x?: number; y?: number }> = {
  ArrowLeft: { x: PAN_STEP },
  ArrowRight: { x: -PAN_STEP },
  ArrowUp: { y: PAN_STEP },
  ArrowDown: { y: -PAN_STEP }
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/** The lightbox's zoom and pan, as motion values, so that a pan does not render. */
export function useZoom() {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(MIN_ZOOM)

  useEffect(() => {
    animate(scale, zoom, settle)
    if (zoom === MIN_ZOOM) {
      animate(x, 0, settle)
      animate(y, 0, settle)
    }
  }, [scale, x, y, zoom])

  const wheel = ({ deltaY }: WheelEvent) => {
    setZoom((current) => clampZoom(current * (1 - deltaY * WHEEL_SPEED)))
  }

  // The wrapper fills the screen, so this is how far past each side it reaches once it is scaled.
  const overhang = (zoom - MIN_ZOOM) / 2

  const reach = { x: window.innerWidth * overhang, y: window.innerHeight * overhang }

  const pan = (key: string) => {
    const { x: across = 0, y: down = 0 } = PANS[key] ?? {}
    x.set(Math.min(reach.x, Math.max(-reach.x, x.get() + across)))
    y.set(Math.min(reach.y, Math.max(-reach.y, y.get() + down)))
  }

  return {
    zoom,
    zoomed: zoom > MIN_ZOOM,
    canZoomIn: zoom < MAX_ZOOM,
    motion: { x, y, scale },
    reach,
    zoomIn: () => setZoom(clampZoom(zoom + ZOOM_STEP)),
    zoomOut: () => setZoom(clampZoom(zoom - ZOOM_STEP)),
    reset: () => setZoom(MIN_ZOOM),
    wheel,
    pan
  }
}
