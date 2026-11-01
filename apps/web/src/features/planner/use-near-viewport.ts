import { type RefObject, useEffect, useState } from 'react'

/** Whether an element is within a screen of being seen, in the scroller around it. */
export function useNearViewport(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    // A root margin only reaches past the root's own edge, so a nested scroller must be the root.
    const root = element.closest('[data-scroll-root]')
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: '100% 0px'
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return near
}
