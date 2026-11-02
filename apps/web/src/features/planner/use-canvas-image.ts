import { type RefObject, useEffect } from 'react'

interface Size {
  width: number
  height: number
}

/**
 * The size to keep an image at so that it still covers `box` on a screen of this density, and never
 * larger than the image itself. Nothing when the box has no size yet, as in a test.
 */
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
  /**
   * Keep only what covers the canvas on screen, as `object-cover` shows it. A thumbnail is several
   * times a cell's size, and the canvas holds every pixel it is given for as long as it is shown.
   */
  cover?: boolean
}

/**
 * Draws a stored image on a canvas that exists only while it is needed. Removing the canvas is what
 * frees the bitmap. An <img> will not do: Chromium keeps what it loaded from a blob: URL after the
 * element and the URL are gone, which on a 300-image board added 120 MB with every scroll through
 * it.
 */
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
    // Each draw has a number, so one that finishes after a later one began, or after the canvas
    // left, lets its bitmap go instead of drawing it.
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
        // A damaged or unreadable image stays an empty cell, which can still be moved or deleted.
      } finally {
        bitmap?.close()
      }
    }
    void draw()

    // A cell that grows, as when the window widens, is drawn again rather than left blurred.
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
