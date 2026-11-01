import { useEffect, useState } from 'react'

import { boardStore } from './planner'

/** An object URL for as long as a cell wants it: letting go frees the decoded image too. */
export function useThumbnail(id: string, wanted: boolean) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!wanted) return
    let current: string | undefined
    let cancelled = false
    void boardStore.getThumbnail(id).then((blob) => {
      if (cancelled || !blob) return
      current = URL.createObjectURL(blob)
      setUrl(current)
    })
    return () => {
      cancelled = true
      if (current) URL.revokeObjectURL(current)
      setUrl(undefined)
    }
  }, [id, wanted])
  return url
}
