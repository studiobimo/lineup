import { type MediaType, type NewPost, uploadRequestSchema } from 'lineup-contract'
import { z } from 'zod'

import type { CellPost } from '@/features/planner/board-schema'
import { instagram } from '@/features/planner/network-profile'
import { boardStore, plannerStore } from '@/features/planner/planner'
import { createStoredStore } from '@/lib/stored-store'

import { answer, providerApi, ProviderRequestError } from './api'

const IDEMPOTENCY_WINDOW_MS = 23 * 3_600_000

const attemptSchema = z.object({
  key: z.string(),
  images: z.array(z.string()),
  mediaUrls: z.array(z.string()),
  startedAt: z.number()
})
type Attempt = z.infer<typeof attemptSchema>

const attemptsSchema = z.record(z.string(), attemptSchema)

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
  const unchanged = earlier.images.join() === images.join()
  return unchanged ? earlier : { ...fresh, key: earlier.key }
}

export class MissingCopyError extends Error {}

type VideoLimit = 'size' | 'length' | 'count'

export class VideoLimitError extends Error {
  readonly limit: VideoLimit

  constructor(limit: VideoLimit) {
    super(`This video is over the ${limit} limit`)
    this.limit = limit
  }
}

const EXTENSIONS: Record<string, string> = { 'video/quicktime': 'mov' }

async function copiesOf(images: string[]) {
  const copies = await Promise.all(images.map((image) => boardStore.getPublishCopy(image)))
  const { images: records } = plannerStore.getState()
  const videos = images.filter((image) => records[image]?.video)
  if (videos.length > instagram.videosPerPost) throw new VideoLimitError('count')
  for (const [index, image] of images.entries()) {
    const copy = copies[index]
    if (!copy) throw new MissingCopyError()
    const video = records[image]?.video
    if (!video) continue
    if (copy.size > instagram.videoSizeLimit) throw new VideoLimitError('size')
    if (video.duration > instagram.reelLengthLimit) throw new VideoLimitError('length')
  }
  return copies as Blob[]
}

async function sendImage(image: string, copy: Blob) {
  const contentType = uploadRequestSchema.shape.contentType.parse(copy.type)
  const extension = EXTENSIONS[contentType] ?? contentType.split('/')[1]
  const fileName = `${image}.${extension}`
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
  onImage: (position: number) => void
}

export async function sendPost({ cell, images, post, onImage }: PostToSend): Promise<CellPost> {
  const copies = await copiesOf(images)
  const attempt = attemptFor(cell, images)
  remember(cell, attempt)
  const mediaUrls = [...attempt.mediaUrls]
  for (const [index, image] of images.entries()) {
    if (index < mediaUrls.length) continue
    onImage(mediaUrls.length + 1)
    mediaUrls.push(await sendImage(image, copies[index]))
    remember(cell, { ...attempt, mediaUrls })
  }
  const mediaTypes = copies.map<MediaType>(({ type }) =>
    type.startsWith('video/') ? 'video' : 'image'
  )
  const media = mediaTypes.includes('video') ? { mediaUrls, mediaTypes } : { mediaUrls }
  const sent = await answer(
    providerApi['scheduled-posts'].$post(
      { json: { ...post, ...media } },
      { headers: { 'Idempotency-Key': attempt.key } }
    )
  )
  forget(cell)
  const { accountId, scheduledFor, timeZone, caption } = post
  return { accountId, scheduledFor, timeZone, caption, ...sent }
}
