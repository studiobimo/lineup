import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createAppRouter } from './router'

describe('router', () => {
  it('renders the home page at /', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
