import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { site } from '@/config/site'
import { createAppRouter } from '@/router'

import { AppProviders } from './app-providers'

vi.mock('@/features/planner/planner-page', () => ({ PlannerPage: () => <h1>planner</h1> }))

describe('NotFound', () => {
  it('says so in a heading and the tab, keeps the shell, and leads back to the board', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/no-such-page'] }))
    const { unmount } = render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )

    await screen.findByRole('heading', { level: 1, name: 'There is no such page' })
    expect(document.title).toBe(`There is no such page · ${site.name}`)
    expect(screen.getByRole('link', { name: 'Back to your board' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: site.name })).toBeInTheDocument()

    unmount()
    expect(document.title).toBe(site.title)
  })
})
