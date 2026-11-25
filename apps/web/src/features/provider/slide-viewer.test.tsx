import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { SlideViewer } from './slide-viewer'

vi.mock('@/features/planner/planner', () => ({
  usePlanner: (select: (state: object) => unknown) => select({ images: {} })
}))
vi.mock('@/features/planner/thumbnail', () => ({
  PictureImage: () => null,
  Thumbnail: ({ id }: { id: string }) => <div data-testid="slide">{id}</div>
}))

const slides = ['a', 'b', 'c'].map((id) => ({ id, video: false }))

function Harness({ items = slides }: { items?: typeof slides }) {
  const [index, setIndex] = useState(0)
  return <SlideViewer slides={items} index={index} onIndexChange={setIndex} />
}

describe('SlideViewer', () => {
  beforeAll(() => loadStrings('provider'))

  it('shows no controls for a single image', () => {
    render(<Harness items={slides.slice(0, 1)} />)
    expect(screen.getByTestId('slide')).toHaveTextContent('a')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws only the slide in view, and steps with the buttons', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getAllByTestId('slide')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(screen.getByTestId('slide')).toHaveTextContent('b')
    await user.click(screen.getByRole('tab', { name: 'Show slide 3 of 3' }))
    expect(screen.getByTestId('slide')).toHaveTextContent('c')
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Show slide 3 of 3' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('steps with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('tab', { name: 'Show slide 1 of 3' }).focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByTestId('slide')).toHaveTextContent('c')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByTestId('slide')).toHaveTextContent('b')
  })
})
