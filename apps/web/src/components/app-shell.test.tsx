import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { site } from '@/config/site'

import { AppShell } from './app-shell'

describe('AppShell', () => {
  it('shows the name and the theme toggle around the page', () => {
    render(<AppShell>page</AppShell>)
    expect(screen.getByRole('banner')).toHaveTextContent(site.name)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('page')
  })
})
