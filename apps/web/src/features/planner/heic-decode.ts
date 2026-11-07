import libheifFactory from 'libheif-js/libheif-wasm/libheif.js'
import wasmUrl from 'libheif-js/libheif-wasm/libheif.wasm?url'

interface HeifImage {
  get_width(): number
  get_height(): number
  display(
    target: { data: Uint8ClampedArray; width: number; height: number },
    done: (filled: unknown) => void
  ): void
  free(): void
}

interface HeifDecoder {
  decode(data: ArrayBuffer | Uint8Array): HeifImage[]
}

interface Libheif {
  HeifDecoder: new () => HeifDecoder
}

let loading: Promise<HeifDecoder> | undefined

/**
 * Fetched once per worker, and only for the first HEIC that a browser could not decode itself.
 * There is one decoder, because a decoder frees the file it holds only when it reads the next one:
 * a new decoder for each file would keep every file in WebAssembly memory, which never shrinks.
 */
function loadDecoder() {
  loading ??= (async () => {
    const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer()
    const libheif = (await libheifFactory({ wasmBinary })) as unknown as Libheif
    return new libheif.HeifDecoder()
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
  const decoder = await loadDecoder()
  const images = decoder.decode(await file.arrayBuffer())
  // Each image holds on to the file until it is freed, the ones not imported too.
  try {
    const [image] = images
    if (!image) throw new Error('This file holds no image')
    const pixels = new ImageData(image.get_width(), image.get_height())
    await new Promise<void>((resolve, reject) =>
      image.display(pixels, (filled) =>
        filled ? resolve() : reject(new Error('libheif could not decode this image'))
      )
    )
    return await createImageBitmap(pixels)
  } finally {
    for (const image of images) image.free()
  }
}
