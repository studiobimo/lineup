import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { ProviderRequestError } from './api'
import { ErrorNotice } from './error-notice'

describe('ErrorNotice', () => {
  beforeAll(() => loadStrings('provider'))

  it('renders nothing without an error', () => {
    render(<ErrorNotice error={null} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says what a request error means', () => {
    render(<ErrorNotice error={new ProviderRequestError()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/.+/)
  })

  it('shows given text as it is', () => {
    render(<ErrorNotice text="Gone wrong" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Gone wrong')
  })
})
