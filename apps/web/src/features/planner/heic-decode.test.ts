import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { decodeHeif } from './heic-decode'

const { decoders, images } = vi.hoisted(() => ({
  decoders: [] as unknown[],
  images: [] as { free: () => void; filled: boolean }[]
}))

function fakeImage(filled = true) {
  const image = {
    filled,
    free: vi.fn(),
    get_width: () => 2,
    get_height: () => 1,
    display: (_: unknown, done: (filled: unknown) => void) => done(image.filled ? {} : null)
  }
  images.push(image)
  return image
}

let nextFile: () => unknown[] = () => [fakeImage()]

vi.mock('libheif-js/libheif-wasm/libheif.wasm?url', () => ({ default: '/libheif.wasm' }))
vi.mock('libheif-js/libheif-wasm/libheif.js', () => ({
  default: async () => ({
    HeifDecoder: class {
      constructor() {
        decoders.push(this)
      }
      decode() {
        return nextFile()
      }
    }
  })
}))

describe('decodeHeif', () => {
  beforeEach(() => {
    images.length = 0
    nextFile = () => [fakeImage()]
    vi.stubGlobal('fetch', async () => new Response(new ArrayBuffer(0)))
    vi.stubGlobal('ImageData', function (width: number, height: number) {
      return { width, height }
    })
    vi.stubGlobal('createImageBitmap', async ({ width, height }: ImageData) => ({ width, height }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps one decoder for every file, so it never holds more than the last one', async () => {
    await decodeHeif(new Blob())
    await decodeHeif(new Blob())

    expect(decoders).toHaveLength(1)
  })

  it('frees every image in the file, the ones it does not import too', async () => {
    nextFile = () => [fakeImage(), fakeImage()]

    await expect(decodeHeif(new Blob())).resolves.toMatchObject({ width: 2, height: 1 })

    for (const image of images) expect(image.free).toHaveBeenCalledOnce()
  })

  it('frees the image when it cannot be decoded', async () => {
    nextFile = () => [fakeImage(false)]

    await expect(decodeHeif(new Blob())).rejects.toThrow('could not decode')

    expect(images[0]?.free).toHaveBeenCalledOnce()
  })
})
