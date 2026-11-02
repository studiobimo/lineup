import { render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { coverSize, useCanvasImage } from './use-canvas-image'

const read = vi.fn<(id: string) => Promise<Blob | undefined>>()

function Cell({ cover = false }: { cover?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useCanvasImage(canvas, 'one', read, { cover })
  return <canvas ref={canvas} data-testid="cell" />
}

describe('coverSize', () => {
  it('keeps enough to cover the box at the screen density, in the image shape', () => {
    expect(coverSize({ width: 480, height: 640 }, { width: 100, height: 100 }, 2)).toEqual({
      width: 200,
      height: 267
    })
  })

  it('covers the side that needs more, for a box another shape from the image', () => {
    expect(coverSize({ width: 640, height: 480 }, { width: 100, height: 200 }, 1)).toEqual({
      width: 267,
      height: 200
    })
  })

  it('never makes an image larger than it is', () => {
    expect(coverSize({ width: 480, height: 640 }, { width: 400, height: 400 }, 3)).toEqual({
      width: 480,
      height: 640
    })
  })

  it('says nothing for a box with no size yet', () => {
    expect(coverSize({ width: 480, height: 640 }, { width: 0, height: 0 }, 2)).toBeUndefined()
  })
})

describe('useCanvasImage', () => {
  const close = vi.fn()
  const bitmap = { width: 480, height: 640, close }
  const transferFromImageBitmap = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    read.mockResolvedValue(new Blob(['image']))
    vi.stubGlobal('createImageBitmap', async () => bitmap)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      transferFromImageBitmap
    } as unknown as ImageBitmapRenderingContext)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('draws the image at its own size', async () => {
    const { getByTestId } = render(<Cell />)
    await waitFor(() => expect(transferFromImageBitmap).toHaveBeenCalledWith(bitmap))
    expect(getByTestId('cell')).toHaveProperty('width', 480)
    expect(getByTestId('cell')).toHaveProperty('height', 640)
  })

  it('keeps only what covers the cell, and lets the full-size bitmap go', async () => {
    const small = { width: 200, height: 267, close: vi.fn() }
    const decode = vi.fn(async (_source: unknown, options?: ImageBitmapOptions) =>
      options ? small : bitmap
    )
    vi.stubGlobal('createImageBitmap', decode)
    vi.stubGlobal('devicePixelRatio', 2)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)

    const { getByTestId } = render(<Cell cover />)

    await waitFor(() => expect(transferFromImageBitmap).toHaveBeenCalledWith(small))
    expect(decode).toHaveBeenLastCalledWith(bitmap, {
      resizeWidth: 200,
      resizeHeight: 267,
      resizeQuality: 'high'
    })
    expect(close).toHaveBeenCalledOnce()
    expect(small.close).not.toHaveBeenCalled()
    expect(getByTestId('cell')).toHaveProperty('width', 200)
  })

  it('closes a bitmap that arrives after the cell left', async () => {
    let arrive: (value: ImageBitmap) => void = () => {}
    vi.stubGlobal('createImageBitmap', () => new Promise((resolve) => (arrive = resolve)))
    const { unmount } = render(<Cell />)
    await waitFor(() => expect(read).toHaveBeenCalled())
    unmount()

    arrive(bitmap as unknown as ImageBitmap)

    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(transferFromImageBitmap).not.toHaveBeenCalled()
  })
})
