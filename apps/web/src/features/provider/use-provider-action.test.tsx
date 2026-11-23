import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ProviderRequestError } from './api'
import { PROVIDER_KEY } from './queries'
import { useProviderAction } from './use-provider-action'

const reply = (ok: boolean, body: unknown = {}) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body)
  })

function setup() {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const remove = vi.spyOn(queryClient, 'removeQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { invalidate, remove, wrapper }
}

describe('useProviderAction', () => {
  it('hands the answer to onSuccess and invalidates the provider queries', async () => {
    const { invalidate, wrapper } = setup()
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () => useProviderAction(() => reply(true, { id: 'p' }), { onSuccess }),
      { wrapper }
    )
    await act(() => result.current.mutateAsync())
    expect(onSuccess).toHaveBeenCalledWith({ id: 'p' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [PROVIDER_KEY] })
  })

  it('reports a failure to onError', async () => {
    const { wrapper } = setup()
    const onError = vi.fn()
    const { result } = renderHook(() => useProviderAction(() => reply(false, {}), { onError }), {
      wrapper
    })
    await act(() => result.current.mutateAsync().catch(() => undefined))
    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(ProviderRequestError)
  })

  it('removes the provider queries instead when asked to', async () => {
    const { invalidate, remove, wrapper } = setup()
    const { result } = renderHook(() => useProviderAction(() => reply(true), { cache: 'remove' }), {
      wrapper
    })
    await act(() => result.current.mutateAsync())
    expect(remove).toHaveBeenCalledWith({ queryKey: [PROVIDER_KEY] })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('leaves the cache alone when asked to keep it', async () => {
    const { invalidate, remove, wrapper } = setup()
    const { result } = renderHook(() => useProviderAction(() => reply(true), { cache: 'keep' }), {
      wrapper
    })
    await act(() => result.current.mutateAsync())
    expect(invalidate).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
})
