import { type RefObject, useEffect } from 'react'

/**
 * Draws a stored image on a canvas that exists only while it is needed. Removing the canvas is what
 * frees the bitmap. An <img> will not do: Chromium keeps what it loaded from a blob: URL after the
 * element and the URL are gone, which on a 300-image board added 120 MB with every scroll through
 * it.
 */
export function useCanvasImage(
  canvas: RefObject<HTMLCanvasElement | null>,
  id: string,
  read: (id: string) => Promise<Blob | undefined>
) {
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('bitmaprenderer')
    if (!element || !context) return
    let cancelled = false
    void read(id)
      .then((blob) => blob && createImageBitmap(blob))
      .then((bitmap) => {
        if (!bitmap) return
        if (cancelled) {
          bitmap.close()
          return
        }
        element.width = bitmap.width
        element.height = bitmap.height
        context.transferFromImageBitmap(bitmap)
      })
      // A damaged or unreadable image stays an empty cell, which can still be moved or deleted.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [canvas, id, read])
}
