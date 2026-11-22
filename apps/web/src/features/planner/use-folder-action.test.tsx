import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { useFolderAction } from './use-folder-action'

const toast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/lasting-toast', () => ({ lastingToast: toast }))

const cancelled = () => new DOMException('closed', 'AbortError')

describe('useFolderAction', () => {
  beforeAll(() => loadStrings('settings'))
  beforeEach(() => toast.mockClear())

  it('is busy while the action runs', async () => {
    const { result } = renderHook(() => useFolderAction())
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    let running = Promise.resolve()
    act(() => {
      running = result.current.run(() => pending)
    })
    await waitFor(() => expect(result.current.busy).toBe(true))
    await act(async () => {
      finish()
      await running
    })
    expect(result.current.busy).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })

  it('stays quiet when the picker is cancelled', async () => {
    const { result } = renderHook(() => useFolderAction())
    await act(() => result.current.run(() => Promise.reject(cancelled())))
    expect(toast).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  it('says the folder failed by default', async () => {
    const { result } = renderHook(() => useFolderAction())
    await act(() => result.current.run(() => Promise.reject(new Error('no'))))
    expect(toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'That folder could not be used. Try again, or choose another one.'
    })
    expect(result.current.busy).toBe(false)
  })

  it('uses the message it is given', async () => {
    const { result } = renderHook(() => useFolderAction())
    await act(() => result.current.run(() => Promise.reject(new Error('no')), 'backupFailed'))
    expect(toast).toHaveBeenCalledWith({
      type: 'error',
      title: 'The backup could not be made. Try again.'
    })
  })
})
