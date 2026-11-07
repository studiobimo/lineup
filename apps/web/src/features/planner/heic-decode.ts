import libheifFactory from 'libheif-js/libheif-wasm/libheif.js'
import wasmUrl from 'libheif-js/libheif-wasm/libheif.wasm?url'

interface HeifImage {
  get_width(): number
  get_height(): number
  display(
    target: { data: Uint8ClampedArray; width: number; height: number },
    done: (filled: unknown) => void
  ): void
}

interface Libheif {
  HeifDecoder: new () => { decode(data: ArrayBuffer | Uint8Array): HeifImage[] }
}

let loading: Promise<Libheif> | undefined

/** Fetched once per worker, and only for the first HEIC that a browser could not decode itself. */
function loadLibheif() {
  loading ??= (async () => {
    const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer()
    return libheifFactory({ wasmBinary }) as unknown as Libheif
  })()
  // A failed load, say offline, is tried again by the next file.
  loading.catch(() => (loading = undefined))
  return loading
}

/**
 * For the browsers with no HEIC decoder of their own, which is every one but Safari. libheif
 * applies the photo's rotation while decoding, so no orientation is left to read.
 */
export async function decodeHeif(file: Blob): Promise<ImageBitmap> {
  const { HeifDecoder } = await loadLibheif()
  const [image] = new HeifDecoder().decode(await file.arrayBuffer())
  if (!image) throw new Error('This file holds no image')
  const width = image.get_width()
  const height = image.get_height()
  const pixels = new ImageData(width, height)
  await new Promise<void>((resolve, reject) =>
    image.display(pixels, (filled) =>
      filled ? resolve() : reject(new Error('libheif could not decode this image'))
    )
  )
  return createImageBitmap(pixels)
}
