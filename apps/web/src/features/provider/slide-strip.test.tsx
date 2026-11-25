import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { SlideStrip } from './slide-strip'

vi.mock('@/features/planner/planner', () => ({
  plannerStore: { getState: () => ({ reorderAlbum: vi.fn(), board: {} }) }
}))
vi.mock('@/features/planner/thumbnail', () => ({ Thumbnail: () => null }))

const slides = ['a', 'b', 'c'].map((id) => ({ id, video: false }))

describe('SlideStrip', () => {
  beforeAll(() => Promise.all([loadStrings('provider'), loadStrings('planner')]))

  it('shows nothing for a single image', () => {
    const { container } = render(
      <SlideStrip cell="a" slides={slides.slice(0, 1)} index={0} onIndexChange={() => undefined} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists every slide in order, marks the one in view and selects on click', async () => {
    const user = userEvent.setup()
    const onIndexChange = vi.fn()
    render(<SlideStrip cell="a" slides={slides} index={1} onIndexChange={onIndexChange} />)
    const items = screen.getAllByRole('button', { name: /^Slide \d$/ })
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Slide 1',
      'Slide 2',
      'Slide 3'
    ])
    expect(items[1]).toHaveAttribute('aria-current', 'true')
    await user.click(items[2])
    expect(onIndexChange).toHaveBeenCalledWith(2)
  })
})
