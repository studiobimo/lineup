import { type RefObject, useEffect, useState } from 'react'

export function useNearViewport(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
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
