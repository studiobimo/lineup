import { render, screen, waitFor } from '@testing-library/react'
import { lazy } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { toastManager } from '@/components/ui/toast'

import { LazyOverlay } from './lazy-overlay'

describe('LazyOverlay', () => {
  it('shows what it loads', async () => {
    const Loaded = lazy(async () => ({ default: () => <p>loaded</p> }))
    render(
      <LazyOverlay onClose={vi.fn()}>
        <Loaded />
      </LazyOverlay>
    )
    expect(await screen.findByText('loaded')).toBeInTheDocument()
  })

  it('closes and says so when its chunk does not arrive', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(toastManager, 'add').mockReturnValue('toast')
    const onClose = vi.fn()
    const Missing = lazy(async (): Promise<{ default: () => null }> => {
      throw new Error('chunk failed')
    })
    render(
      <LazyOverlay onClose={onClose}>
        <Missing />
      </LazyOverlay>
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toastManager.add).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
  })
})
