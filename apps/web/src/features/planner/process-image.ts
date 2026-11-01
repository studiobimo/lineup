import { extractColour, type ImageColour } from '@/features/autosort/colour'

const PUBLISH_MAX_WIDTH = 1440
const PUBLISH_QUALITY = 0.9
// Cells crop to cover, so it is the short side that has to fill one on a dense phone screen.
const THUMBNAIL_SHORT_SIDE = 480
const THUMBNAIL_QUALITY = 0.8
// About a thousand pixels: plenty for a colour, and cheap to cluster.
const COLOUR_SAMPLE_LONG_SIDE = 32

interface Size {
  width: number
  height: number
}

export interface ProcessedImage extends Size {
  thumbnail: Blob
  publish: Blob
  colour: ImageColour
}

/** Scales down by `factor`, and never up. */
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

export function colourSampleSize(size: Size): Size {
  return scale(size, COLOUR_SAMPLE_LONG_SIDE / Math.max(size.width, size.height))
}

function draw(source: CanvasImageSource, { width, height }: Size): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser gave no 2d context')
  // JPEG has no alpha: without a background, what is transparent in a PNG comes out black.
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

/** For an image stored before colours were kept. Its thumbnail is all that is needed. */
export async function colourOf(file: Blob) {
  const bitmap = await createImageBitmap(file)
  try {
    return sampleColour(bitmap, bitmap)
  } finally {
    bitmap.close()
  }
}

/** The originals are not kept (ADR-0002), so these two copies are all a board ever holds. */
export async function processImage(file: Blob): Promise<ProcessedImage> {
  // A phone stores a portrait photo sideways, with a tag saying so.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const size = publishSize(bitmap)
    const publish = draw(bitmap, size)
    const thumbnail = draw(publish, thumbnailSize(size))
    return {
      ...size,
      colour: sampleColour(thumbnail, thumbnail),
      publish: await publish.convertToBlob({ type: 'image/jpeg', quality: PUBLISH_QUALITY }),
      thumbnail: await thumbnail.convertToBlob({ type: 'image/jpeg', quality: THUMBNAIL_QUALITY })
    }
  } finally {
    bitmap.close()
  }
}
