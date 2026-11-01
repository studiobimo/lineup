import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppProviders } from './components/app-providers'
import { createAppRouter } from './router'

describe('router', () => {
  it('renders the home page at /', async () => {
    const queryClient = new QueryClient()
    const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: ['/'] }))
    render(
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    )
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
