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

function loadDecoder() {
  loading ??= (async () => {
    const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer()
    const libheif = (await libheifFactory({ wasmBinary })) as unknown as Libheif
    return new libheif.HeifDecoder()
  })()
  loading.catch(() => (loading = undefined))
  return loading
}

export async function decodeHeif(file: Blob): Promise<ImageBitmap> {
  const decoder = await loadDecoder()
  const images = decoder.decode(await file.arrayBuffer())
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
