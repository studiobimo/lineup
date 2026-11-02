import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { toastManager } from '@/components/ui/toast'

import { AppProviders } from './app-providers'

describe('AppProviders', () => {
  it('shows toasts raised from outside React', async () => {
    render(
      <AppProviders>
        <p>page</p>
      </AppProviders>
    )
    toastManager.add({ title: 'Saved' })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })
})
