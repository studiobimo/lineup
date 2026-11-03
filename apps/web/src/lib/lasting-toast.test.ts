import { describe, expect, it, vi } from 'vitest'

import { toastManager } from '@/components/ui/toast'

import { lastingToast } from './lasting-toast'

describe('lastingToast', () => {
  it('stays until its button closes it', () => {
    const add = vi.spyOn(toastManager, 'add').mockReturnValue('the-toast')
    const close = vi.spyOn(toastManager, 'close').mockImplementation(() => undefined)

    lastingToast({ type: 'error', title: 'Storage is full' })

    const [toast] = add.mock.lastCall!
    expect(toast).toMatchObject({ type: 'error', title: 'Storage is full', timeout: 0 })
    expect(toast.actionProps?.children).toBe('Dismiss')
    toast.actionProps?.onClick?.({} as never)
    expect(close).toHaveBeenCalledWith('the-toast')
  })
})
