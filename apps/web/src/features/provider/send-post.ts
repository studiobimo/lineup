import { type NewPost, uploadRequestSchema } from 'lineup-contract'
import { z } from 'zod'

import type { CellPost } from '@/features/planner/board-schema'
import { boardStore } from '@/features/planner/planner'
import { createStoredStore } from '@/lib/stored-store'

import { answer, providerApi, ProviderRequestError } from './api'

/** The provider returns the first answer to a key for 24 hours. After that a key is a new post. */
const IDEMPOTENCY_WINDOW_MS = 23 * 3_600_000

const attemptSchema = z.object({
  key: z.string(),
  images: z.array(z.string()),
  mediaUrls: z.array(z.string()),
  startedAt: z.number()
})
type Attempt = z.infer<typeof attemptSchema>

const attemptsSchema = z.record(z.string(), attemptSchema)

// Kept past a reload: a request can arrive with its answer lost, and only the same key is safe then.
const { store, save } = createStoredStore<{ attempts: Record<string, Attempt> }>(
  'schedule-attempts',
  ({ attempts }) => ({ attempts: attemptsSchema.catch({}).parse(attempts) })
)

const remember = (cell: string, attempt: Attempt) =>
  save({ attempts: { ...store.getState().attempts, [cell]: attempt } })

function forget(cell: string) {
  const attempts = { ...store.getState().attempts }
  delete attempts[cell]
  save({ attempts })
}

function attemptFor(cell: string, images: string[]): Attempt {
  const earlier = store.getState().attempts[cell]
  const fresh = { images, mediaUrls: [], startedAt: Date.now() }
  if (!earlier || Date.now() - earlier.startedAt > IDEMPOTENCY_WINDOW_MS) {
    return { ...fresh, key: crypto.randomUUID() }
  }
  // An album reordered since then needs sending again, under the key that is still at the provider.
  const unchanged = earlier.images.join() === images.join()
  return unchanged ? earlier : { ...fresh, key: earlier.key }
}

/** The image is gone from this device, which trying again will not change. */
export class MissingCopyError extends Error {}

async function sendImage(image: string) {
  const copy = await boardStore.getPublishCopy(image)
  if (!copy) throw new MissingCopyError()
  const contentType = uploadRequestSchema.shape.contentType.parse(copy.type)
  const fileName = `${image}.${contentType.split('/')[1]}`
  const { uploadUrl, mediaUrl } = await answer(
    providerApi.uploads.$post({ json: { fileName, contentType, size: copy.size } })
  )
  const sent = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: copy
  }).catch(() => undefined)
  if (!sent?.ok) throw new ProviderRequestError()
  return mediaUrl
}

interface PostToSend {
  cell: string
  images: string[]
  post: Omit<NewPost, 'mediaUrls'>
  /** Which image is on its way, from 1. */
  onImage: (position: number) => void
}

/** Images go one at a time, in album order, and a retry picks up from the first one not sent. */
export async function sendPost({ cell, images, post, onImage }: PostToSend): Promise<CellPost> {
  const attempt = attemptFor(cell, images)
  remember(cell, attempt)
  const mediaUrls = [...attempt.mediaUrls]
  for (const image of images.slice(mediaUrls.length)) {
    onImage(mediaUrls.length + 1)
    mediaUrls.push(await sendImage(image))
    remember(cell, { ...attempt, mediaUrls })
  }
  const sent = await answer(
    providerApi['scheduled-posts'].$post(
      { json: { ...post, mediaUrls } },
      { headers: { 'Idempotency-Key': attempt.key } }
    )
  )
  forget(cell)
  const { accountId, scheduledFor, timeZone, caption } = post
  return { accountId, scheduledFor, timeZone, caption, ...sent }
}
