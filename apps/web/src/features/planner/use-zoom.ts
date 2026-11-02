import { animate, useMotionValue } from 'motion/react'
import { useEffect, useState, type WheelEvent } from 'react'

import { settle } from './motion'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1
const WHEEL_SPEED = 0.002

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

  return {
    zoom,
    zoomed: zoom > MIN_ZOOM,
    canZoomIn: zoom < MAX_ZOOM,
    motion: { x, y, scale },
    reach: { x: window.innerWidth * overhang, y: window.innerHeight * overhang },
    zoomIn: () => setZoom(clampZoom(zoom + ZOOM_STEP)),
    zoomOut: () => setZoom(clampZoom(zoom - ZOOM_STEP)),
    reset: () => setZoom(MIN_ZOOM),
    wheel
  }
}
