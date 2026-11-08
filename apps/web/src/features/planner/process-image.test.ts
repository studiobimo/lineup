import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { decodeHeif } from './heic-decode'
import { processImage, publishSize, thumbnailSize } from './process-image'

vi.mock('./heic-decode', () => ({ decodeHeif: vi.fn() }))

const readNothing = { readCaptureDates: false, readLocations: false }

describe('publishSize', () => {
  it('brings a wide image down to 1440 and keeps its shape', () => {
    expect(publishSize({ width: 6000, height: 4000 })).toEqual({ width: 1440, height: 960 })
  })

  it('never upscales', () => {
    expect(publishSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
  })

  it('leaves no side at zero on an extreme shape', () => {
    expect(publishSize({ width: 100000, height: 10 })).toEqual({ width: 1440, height: 1 })
  })
})

describe('thumbnailSize', () => {
  it('fits the short side, so a landscape image still fills a cell', () => {
    expect(thumbnailSize({ width: 1440, height: 960 })).toEqual({ width: 720, height: 480 })
    expect(thumbnailSize({ width: 960, height: 1440 })).toEqual({ width: 480, height: 720 })
  })

  it('never upscales', () => {
    expect(thumbnailSize({ width: 300, height: 200 })).toEqual({ width: 300, height: 200 })
  })
})

describe('processImage', () => {
  const calls: string[] = []
  const close = vi.fn()

  class FakeCanvas {
    getContext = () => ({
      fillRect: () => calls.push('fill'),
      drawImage: () => calls.push('draw'),
      getImageData: () => ({ data: Uint8ClampedArray.of(200, 40, 40, 255) })
    })
    convertToBlob = async () => new Blob(['jpeg'], { type: 'image/jpeg' })
  }

  beforeEach(() => {
    calls.length = 0
    close.mockClear()
    vi.mocked(decodeHeif).mockReset()
    vi.stubGlobal('OffscreenCanvas', FakeCanvas)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('makes both copies, on white, and lets go of the decoded image', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 6000, height: 4000, close }))

    const image = await processImage(new Blob(), readNothing)

    expect(image).toMatchObject({ width: 1440, height: 960 })
    expect(image.publish.type).toBe('image/jpeg')
    expect(image.thumbnail.type).toBe('image/jpeg')
    expect(calls).toEqual(['fill', 'draw', 'fill', 'draw', 'fill', 'draw'])
    expect(close).toHaveBeenCalledOnce()
  })

  it('respects the orientation a photo was saved with', async () => {
    const decode = vi.fn(async () => ({ width: 100, height: 100, close }))
    vi.stubGlobal('createImageBitmap', decode)

    await processImage(new Blob(), readNothing)

    expect(decode).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' })
  })

  it('lets go of the decoded image when a copy fails', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close }))
    vi.stubGlobal(
      'OffscreenCanvas',
      class extends FakeCanvas {
        getContext = () => null as never
      }
    )

    await expect(processImage(new Blob(), readNothing)).rejects.toThrow()
    expect(close).toHaveBeenCalledOnce()
  })

  describe('a HEIC photo', () => {
    const heic = () => new Blob([new Uint8Array([0, 0, 0, 24, ...Buffer.from('ftypheic')])])
    const refuse = async () => {
      throw new Error('The source image cannot be decoded')
    }

    it('goes to the HEIC decoder when the browser cannot read it', async () => {
      vi.stubGlobal('createImageBitmap', refuse)
      vi.mocked(decodeHeif).mockResolvedValue({ width: 4032, height: 3024, close } as ImageBitmap)

      const image = await processImage(heic(), readNothing)

      expect(image).toMatchObject({ width: 1440, height: 1080 })
      expect(image.publish.type).toBe('image/jpeg')
      expect(image.thumbnail.type).toBe('image/jpeg')
      expect(close).toHaveBeenCalledOnce()
    })

    it('never reaches the HEIC decoder when the browser reads it itself', async () => {
      vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close }))

      await processImage(heic(), readNothing)

      expect(decodeHeif).not.toHaveBeenCalled()
    })

    it('does not load the decoder for a file that is not HEIC, and says why it failed', async () => {
      vi.stubGlobal('createImageBitmap', refuse)

      await expect(processImage(new Blob(['not an image']), readNothing)).rejects.toThrow(
        'cannot be decoded'
      )
      expect(decodeHeif).not.toHaveBeenCalled()
    })
  })
})
