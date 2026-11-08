import { useSyncExternalStore } from 'react'

function onResize(notify: () => void) {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}

export function useFitScale(width: number, height: number, margin: number) {
  return useSyncExternalStore(onResize, () =>
    Math.min(1, (window.innerWidth - margin) / width, (window.innerHeight - margin) / height)
  )
}
