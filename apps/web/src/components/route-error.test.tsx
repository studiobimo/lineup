import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createAppRouter } from '@/router'

import { AppProviders } from './app-providers'

const page = vi.hoisted(() => ({ broken: true }))

vi.mock('@/features/planner/planner-page', () => ({
  PlannerPage() {
    if (page.broken) throw new Error('broken')
    return <h1>planner</h1>
  }
}))

describe('RouteError', () => {
  it('keeps the shell when a page crashes, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: ['/'] }))
    render(
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    )

    await screen.findByRole('heading', { name: 'This page ran into a problem' })
    expect(screen.getByRole('banner')).toBeInTheDocument()

    page.broken = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'planner' })
  })
})
