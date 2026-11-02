import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppProviders } from './components/app-providers'
import { createAppRouter } from './router'

describe('router', () => {
  it('renders the home page at /', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
