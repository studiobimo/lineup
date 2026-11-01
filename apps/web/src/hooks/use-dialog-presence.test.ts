import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDialogPresence } from './use-dialog-presence'

describe('useDialogPresence', () => {
  it('starts closed and opens a frame later, so there is a change to animate', async () => {
    const { result } = renderHook(() => useDialogPresence(vi.fn()))
    expect(result.current.dialog.open).toBe(false)
    await waitFor(() => expect(result.current.dialog.open).toBe(true))
  })

  it('only reports the close once the exit has played', async () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useDialogPresence(onClose))
    await waitFor(() => expect(result.current.dialog.open).toBe(true))

    act(() => result.current.close())
    expect(result.current.dialog.open).toBe(false)
    expect(onClose).not.toHaveBeenCalled()

    act(() => result.current.dialog.onOpenChangeComplete(false))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not report a close when the entrance finishes', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useDialogPresence(onClose))
    act(() => result.current.dialog.onOpenChangeComplete(true))
    expect(onClose).not.toHaveBeenCalled()
  })
})
