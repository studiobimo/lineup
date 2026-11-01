import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '@/components/app-providers'
import { createAppRouter } from '@/router'

function open(path: string) {
  const queryClient = new QueryClient()
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }))
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

describe('legal pages', () => {
  it('says what is stored where', async () => {
    open('/privacy')

    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })
    expect(screen.getByRole('heading', { name: 'On your device' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Zernio key' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What goes to Zernio' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'On our servers' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Privacy policy · Lineup'))
  })

  it('links one to the other', async () => {
    const user = userEvent.setup()
    open('/terms')

    await user.click(await screen.findByRole('link', { name: 'Privacy policy' }))
    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })
  })
})
