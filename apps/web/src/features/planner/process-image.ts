import { extractColour, type ImageColour } from '@/features/autosort/colour'

import type { ImportSettings } from './import-settings'
import { looksLikeHeif } from './looks-like-heif'
import { type PhotoMetadata, readMetadata } from './photo-metadata'
import type { VideoInfo } from './video-frame'

const PUBLISH_MAX_WIDTH = 1440
const PUBLISH_QUALITY = 0.9
const THUMBNAIL_SHORT_SIDE = 480
const THUMBNAIL_QUALITY = 0.8
const COLOUR_SAMPLE_LONG_SIDE = 32

interface Size {
  width: number
  height: number
}

export interface ProcessedImage extends Size, PhotoMetadata {
  thumbnail: Blob
  publish: Blob
  original?: Blob
  colour: ImageColour
  video?: VideoInfo
}

function scale({ width, height }: Size, factor: number): Size {
  const capped = Math.min(1, factor)
  return {
    width: Math.max(1, Math.round(width * capped)),
    height: Math.max(1, Math.round(height * capped))
  }
}

export function publishSize(size: Size): Size {
  return scale(size, PUBLISH_MAX_WIDTH / size.width)
}

export function thumbnailSize(size: Size): Size {
  return scale(size, THUMBNAIL_SHORT_SIDE / Math.min(size.width, size.height))
}

function colourSampleSize(size: Size): Size {
  return scale(size, COLOUR_SAMPLE_LONG_SIDE / Math.max(size.width, size.height))
}

function draw(source: CanvasImageSource, { width, height }: Size): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser gave no 2d context')
  context.fillStyle = 'white'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

function sampleColour(source: CanvasImageSource, size: Size) {
  const { width, height } = colourSampleSize(size)
  const context = draw(source, { width, height }).getContext('2d')
  if (!context) throw new Error('This browser gave no 2d context')
  return extractColour(context.getImageData(0, 0, width, height).data)
}

export async function colourOf(file: Blob) {
  const bitmap = await createImageBitmap(file)
  try {
    return sampleColour(bitmap, bitmap)
  } finally {
    bitmap.close()
  }
}

async function decode(file: Blob) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (error) {
    if (!(await looksLikeHeif(file))) throw error
    return (await import('./heic-decode')).decodeHeif(file)
  }
}

export async function processImage(file: Blob, read: ImportSettings): Promise<ProcessedImage> {
  const bitmap = await decode(file)
  try {
    const size = publishSize(bitmap)
    const publish = draw(bitmap, size)
    const thumbnail = draw(publish, thumbnailSize(size))
    return {
      ...size,
      colour: sampleColour(thumbnail, thumbnail),
      ...(await readMetadata(file, read)),
      publish: await publish.convertToBlob({ type: 'image/jpeg', quality: PUBLISH_QUALITY }),
      thumbnail: await thumbnail.convertToBlob({ type: 'image/jpeg', quality: THUMBNAIL_QUALITY })
    }
  } finally {
    bitmap.close()
  }
}
