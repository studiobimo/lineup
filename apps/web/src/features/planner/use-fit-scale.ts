import { useSyncExternalStore } from 'react'

function onResize(notify: () => void) {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}

/** How far to shrink something of this size to fit the window. It never grows past its real size. */
export function useFitScale(width: number, height: number, margin: number) {
  return useSyncExternalStore(onResize, () =>
    Math.min(1, (window.innerWidth - margin) / width, (window.innerHeight - margin) / height)
  )
}
