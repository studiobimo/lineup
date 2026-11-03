import { useEffect } from 'react'

import { site } from '@/config/site'

/** Names the tab after the page, and gives the site its own title back on the way out. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${site.name}`
    return () => {
      document.title = site.title
    }
  }, [title])
}
