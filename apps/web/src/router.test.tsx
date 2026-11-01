import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createAppRouter } from './router'

describe('router', () => {
  it('renders the home page at /', async () => {
    const queryClient = new QueryClient()
    const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: ['/'] }))
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
