import type { z } from 'zod'

import type { videoTypeSchema } from './board-schema'
import { publishSize } from './process-image'

export type VideoType = z.infer<typeof videoTypeSchema>

export interface VideoInfo {
  type: VideoType
  /** In seconds. */
  duration: number
}

// Instagram takes these two and no other, so a file it would refuse is never planned (ADR-0022).
const VIDEO_EXTENSIONS: Record<string, VideoType> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime'
}
const VIDEO_TYPES = new Set<string>(Object.values(VIDEO_EXTENSIONS))

/** A browser that does not know a type leaves it empty, so the name is asked as well. */
export function videoTypeOf(file: Blob): VideoType | undefined {
  if (VIDEO_TYPES.has(file.type)) return file.type as VideoType
  if (file.type !== '' || !(file instanceof File)) return undefined
  return VIDEO_EXTENSIONS[file.name.split('.').pop()?.toLowerCase() ?? '']
}

// Just past the start, where a video that fades in has something to show.
const FRAME_AT_SECONDS = 0.1
const FRAME_QUALITY = 0.92
const TIMEOUT_MS = 15_000

function once(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No ${event} from this video`)), TIMEOUT_MS)
    const settle = (done: () => void) => () => {
      clearTimeout(timer)
      video.removeEventListener(event, ok)
      video.removeEventListener('error', failed)
      done()
    }
    const ok = settle(resolve)
    const failed = settle(() => reject(new Error('This video will not decode')))
    video.addEventListener(event, ok)
    video.addEventListener('error', failed)
  })
}

export interface VideoFrame {
  /** A JPEG of the frame at publish size, for the usual image pipeline to work from. */
  frame: Blob
  duration: number
}

/**
 * On the main thread, because a worker has no `<video>`. Only one frame is decoded, and the
 * element and its URL are let go before this returns, so a batch holds one video at a time.
 */
export async function firstFrame(file: Blob): Promise<VideoFrame> {
  const video = document.createElement('video')
  const url = URL.createObjectURL(file)
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    const loaded = once(video, 'loadeddata')
    video.src = url
    await loaded
    const { duration, videoWidth, videoHeight } = video
    if (!videoWidth || !videoHeight) throw new Error('This video has no picture')
    const seeked = once(video, 'seeked')
    video.currentTime = Math.min(FRAME_AT_SECONDS, (duration || 0) / 2)
    await seeked
    const { width, height } = publishSize({ width: videoWidth, height: videoHeight })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser gave no 2d context')
    context.drawImage(video, 0, 0, width, height)
    const frame = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', FRAME_QUALITY)
    )
    if (!frame) throw new Error('This frame would not encode')
    return { frame, duration: Number.isFinite(duration) ? duration : 0 }
  } finally {
    // Emptied, or Chromium keeps the decoder and its buffers until the element is collected.
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
