import { render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasImage } from './use-canvas-image'

const read = vi.fn<(id: string) => Promise<Blob | undefined>>()

function Cell() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useCanvasImage(canvas, 'one', read)
  return <canvas ref={canvas} data-testid="cell" />
}

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

  it('draws the image at its own size', async () => {
    const { getByTestId } = render(<Cell />)
    await waitFor(() => expect(transferFromImageBitmap).toHaveBeenCalledWith(bitmap))
    expect(getByTestId('cell')).toHaveProperty('width', 480)
    expect(getByTestId('cell')).toHaveProperty('height', 640)
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
