import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { processImage, publishSize, thumbnailSize } from './process-image'

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
      drawImage: () => calls.push('draw')
    })
    convertToBlob = async () => new Blob(['jpeg'], { type: 'image/jpeg' })
  }

  beforeEach(() => {
    calls.length = 0
    close.mockClear()
    vi.stubGlobal('OffscreenCanvas', FakeCanvas)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('makes both copies, on white, and lets go of the decoded image', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 6000, height: 4000, close }))

    const image = await processImage(new Blob())

    expect(image).toMatchObject({ width: 1440, height: 960 })
    expect(image.publish.type).toBe('image/jpeg')
    expect(image.thumbnail.type).toBe('image/jpeg')
    expect(calls).toEqual(['fill', 'draw', 'fill', 'draw'])
    expect(close).toHaveBeenCalledOnce()
  })

  it('respects the orientation a photo was saved with', async () => {
    const decode = vi.fn(async () => ({ width: 100, height: 100, close }))
    vi.stubGlobal('createImageBitmap', decode)

    await processImage(new Blob())

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

    await expect(processImage(new Blob())).rejects.toThrow()
    expect(close).toHaveBeenCalledOnce()
  })
})
