import type { PublishedPost } from 'lineup-contract'
import { useEffect } from 'react'

import { setNeighbours } from '@/features/autosort/neighbours'
import { bandRows, toBandCell } from '@/features/autosort/sort'
import { instagram } from '@/features/planner/network-profile'
import { sampleColour } from '@/features/planner/process-image'

const LOG_TAG = '[magic sort]'
const NEIGHBOUR_COUNT = instagram.columns * Math.max(...Object.values(bandRows))

type Failure = 'no-thumbnail' | 'cors-blocked' | 'unreachable' | 'canvas-tainted'

function loadImage(url: string, crossOrigin: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image did not load'))
    image.src = url
  })
}

async function whyItFailed(url: string): Promise<Failure> {
  return loadImage(url, false).then(
    () => 'cors-blocked',
    () => 'unreachable'
  )
}

async function neighbourCell({ id, thumbnailUrl }: PublishedPost) {
  if (!thumbnailUrl) return { id, failure: 'no-thumbnail' as Failure }
  const image = await loadImage(thumbnailUrl, true).catch(() => undefined)
  if (!image) return { id, failure: await whyItFailed(thumbnailUrl) }
  try {
    const size = { width: image.naturalWidth, height: image.naturalHeight }
    return { id, cell: toBandCell({ id }, sampleColour(image, size)) }
  } catch {
    return { id, failure: 'canvas-tainted' as Failure }
  }
}

async function readNeighbours(posts: PublishedPost[]) {
  const results = await Promise.all(posts.slice(0, NEIGHBOUR_COUNT).map(neighbourCell))
  const cells = results.flatMap(({ cell }) => (cell ? [cell] : []))
  const failures = results.flatMap(({ id, failure }) => (failure ? [{ id, failure }] : []))
  if (failures.length > 0) {
    console.warn(LOG_TAG, `read ${cells.length} of ${results.length} neighbour colours`, failures)
  } else {
    console.info(LOG_TAG, `read ${cells.length} neighbour colours`)
  }
  return cells
}

export function useNeighbourColours(posts: PublishedPost[] | undefined) {
  useEffect(() => {
    if (!posts) return
    let current = true
    void readNeighbours(posts).then((cells) => {
      if (current) setNeighbours(cells)
    })
    return () => {
      current = false
    }
  }, [posts])
}
