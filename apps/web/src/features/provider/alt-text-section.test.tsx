import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { AltTextSection } from './alt-text-section'

const slides = [
  { id: 'a', video: false },
  { id: 'b', video: true },
  { id: 'c', video: false }
]

describe('AltTextSection', () => {
  beforeAll(() => loadStrings('provider'))

  it('is closed, and opens to one field for each picture and none for a video', async () => {
    const user = userEvent.setup()
    render(<AltTextSection slides={slides} altTexts={[]} onChange={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Accessibility' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.getByLabelText('Alt text for slide 1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Alt text for slide 2')).toBeNull()
    expect(screen.getByLabelText('Alt text for slide 3')).toBeInTheDocument()
  })

  it('reports the text by slide', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AltTextSection slides={slides} altTexts={['A cat']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Accessibility' }))
    await user.type(screen.getByLabelText('Alt text for slide 3'), 'D')
    expect(onChange).toHaveBeenLastCalledWith(['A cat', '', 'D'])
  })

  it('shows nothing for a video alone', () => {
    const { container } = render(
      <AltTextSection
        slides={[{ id: 'v', video: true }]}
        altTexts={[]}
        onChange={() => undefined}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
