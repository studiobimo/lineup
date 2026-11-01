import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { site } from '@/config/site'

import { AppShell } from './app-shell'

describe('AppShell', () => {
  it('shows the name and the theme toggle around the page', async () => {
    const routeTree = createRootRoute({ component: () => <AppShell>page</AppShell> })
    render(<RouterProvider router={createRouter({ routeTree, history: createMemoryHistory() })} />)

    expect(await screen.findByRole('link', { name: site.name })).toHaveAttribute('href', '/')
    expect(screen.getByRole('banner')).toHaveTextContent(site.name)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('page')
  })
})
