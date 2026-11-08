import { type RefObject, useEffect } from 'react'

interface Size {
  width: number
  height: number
}

export function coverSize(image: Size, box: Size, density: number): Size | undefined {
  if (box.width <= 0 || box.height <= 0) return undefined
  const scale = Math.min(
    1,
    Math.max((box.width * density) / image.width, (box.height * density) / image.height)
  )
  return {
    width: Math.max(1, Math.ceil(image.width * scale)),
    height: Math.max(1, Math.ceil(image.height * scale))
  }
}

function paint(
  element: HTMLCanvasElement,
  context: ImageBitmapRenderingContext,
  bitmap: ImageBitmap
) {
  element.width = bitmap.width
  element.height = bitmap.height
  context.transferFromImageBitmap(bitmap)
}

interface CanvasImageOptions {
  cover?: boolean
}

export function useCanvasImage(
  canvas: RefObject<HTMLCanvasElement | null>,
  id: string,
  read: (id: string) => Promise<Blob | undefined>,
  { cover = false }: CanvasImageOptions = {}
) {
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('bitmaprenderer')
    if (!element || !context) return
    let latest = 0
    let full: Size | undefined
    const shown = () => ({ width: element.clientWidth, height: element.clientHeight })

    const draw = async () => {
      const drawing = ++latest
      const stale = () => drawing !== latest
      let bitmap: ImageBitmap | undefined
      try {
        const blob = await read(id)
        if (!blob || stale()) return
        bitmap = await createImageBitmap(blob)
        full = { width: bitmap.width, height: bitmap.height }
        const target = cover ? coverSize(bitmap, shown(), devicePixelRatio) : undefined
        if (!stale() && target && target.width < bitmap.width) {
          const decoded = bitmap
          bitmap = await createImageBitmap(decoded, {
            resizeWidth: target.width,
            resizeHeight: target.height,
            resizeQuality: 'high'
          })
          decoded.close()
        }
        if (stale()) return
        paint(element, context, bitmap)
        bitmap = undefined
      } catch {
        return
      } finally {
        bitmap?.close()
      }
    }
    void draw()

    const observer =
      cover && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            const needed = full && coverSize(full, shown(), devicePixelRatio)
            if (needed && needed.width > element.width) void draw()
          })
        : undefined
    observer?.observe(element)

    return () => {
      latest += 1
      observer?.disconnect()
    }
  }, [canvas, id, read, cover])
}
