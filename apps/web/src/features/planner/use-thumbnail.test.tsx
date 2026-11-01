import { render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { boardStore } from './planner'
import { useThumbnail } from './use-thumbnail'

function Cell() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useThumbnail(canvas, 'one')
  return <canvas ref={canvas} data-testid="cell" />
}

describe('useThumbnail', () => {
  const close = vi.fn()
  const bitmap = { width: 480, height: 640, close }
  const transferFromImageBitmap = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(boardStore, 'getThumbnail').mockResolvedValue(new Blob(['thumbnail']))
    vi.stubGlobal('createImageBitmap', async () => bitmap)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      transferFromImageBitmap
    } as unknown as ImageBitmapRenderingContext)
  })

  it('draws the thumbnail at its own size', async () => {
    const { getByTestId } = render(<Cell />)
    await waitFor(() => expect(transferFromImageBitmap).toHaveBeenCalledWith(bitmap))
    expect(getByTestId('cell')).toHaveProperty('width', 480)
    expect(getByTestId('cell')).toHaveProperty('height', 640)
  })

  it('closes a bitmap that arrives after the cell left', async () => {
    let arrive: (value: ImageBitmap) => void = () => {}
    vi.stubGlobal('createImageBitmap', () => new Promise((resolve) => (arrive = resolve)))
    const { unmount } = render(<Cell />)
    await waitFor(() => expect(boardStore.getThumbnail).toHaveBeenCalled())
    unmount()

    arrive(bitmap as unknown as ImageBitmap)

    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(transferFromImageBitmap).not.toHaveBeenCalled()
  })
})
