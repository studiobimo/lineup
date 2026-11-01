import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { toastManager } from '@/components/ui/toast'

import { AppProviders } from './app-providers'

describe('AppProviders', () => {
  it('gives its children the query client', () => {
    const queryClient = new QueryClient()
    let seen: QueryClient | undefined
    function Child() {
      seen = useQueryClient()
      return null
    }
    render(
      <AppProviders queryClient={queryClient}>
        <Child />
      </AppProviders>
    )
    expect(seen).toBe(queryClient)
  })

  it('shows toasts raised from outside React', async () => {
    render(
      <AppProviders queryClient={new QueryClient()}>
        <p>page</p>
      </AppProviders>
    )
    toastManager.add({ title: 'Saved' })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })
})
