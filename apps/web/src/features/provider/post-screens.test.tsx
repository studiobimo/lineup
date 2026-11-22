import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import type { TagDraft } from './tags'
import { PostScreens } from './post-screens'

vi.mock('./post-thumbnail', () => ({ PostThumbnail: () => <div data-testid="thumbnail" /> }))
vi.mock('./tag-picker', () => ({ TagPicker: () => <p>picker</p> }))
vi.mock('./use-misordered', () => ({ isMisordered: () => false }))
vi.mock('./use-spacing', () => ({
  useSpacing: () => ({
    near: [{ side: 'before', slot: { cell: 'c', at: 0, gap: 300_000, video: false }, position: 2 }],
    suggested: new Date('2999-01-01T10:05:00')
  })
}))
vi.mock('@/features/planner/planner', () => ({
  plannerStore: { getState: () => ({ board: {} }) }
}))

const FUTURE = '2999-01-01T10:00'

function setup(problem?: string, tags: TagDraft[] = []) {
  const onSubmit = vi.fn(() => Promise.resolve())
  const view = (error?: string) => (
    <PostScreens
      cell="a"
      initial={{ caption: '', when: FUTURE }}
      slides={[{ id: 'a', video: false }]}
      tags={tags}
      submitLabel="Schedule"
      pending={false}
      problem={error}
      onTagsChange={() => undefined}
      onSubmit={onSubmit}
    >
      <p>notice</p>
    </PostScreens>
  )
  return { onSubmit, view, ...render(view(problem)) }
}

describe('PostScreens', () => {
  beforeAll(() => loadStrings('provider'))

  it('shows everything on one screen, with no steps', () => {
    setup()
    expect(screen.getByLabelText('Caption')).toBeInTheDocument()
    expect(screen.getByText('notice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tag accounts' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    expect(screen.queryByText(/Step 1/)).toBeNull()
  })

  it('schedules without tagging', async () => {
    const user = userEvent.setup()
    const { onSubmit } = setup()
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSubmit).toHaveBeenCalledWith({ caption: '', when: FUTURE })
  })

  it('warns about spacing without blocking Schedule, and the suggestion fills the time', async () => {
    const user = userEvent.setup()
    const { onSubmit } = setup()
    expect(screen.getByText(/position 2 on your grid/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSubmit).toHaveBeenCalledWith({ caption: '', when: FUTURE })
    await user.click(screen.getByRole('button', { name: /^Use / }))
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ caption: '', when: '2999-01-01T10:05' })
  })

  it('opens the tag screen and returns to the main one with the caption kept', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Caption'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Tag accounts' }))
    expect(screen.getByRole('heading', { name: 'Tag accounts' })).toHaveFocus()
    expect(screen.getByText('picker')).toBeInTheDocument()
    expect(screen.queryByLabelText('Caption')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByLabelText('Caption')).toHaveValue('Hello')
    expect(screen.getByRole('button', { name: 'Tag accounts' })).toHaveFocus()
  })

  it('counts and names the tags on the main screen', () => {
    setup(undefined, [{ key: 'k', username: 'friend', mediaIndex: 0 }])
    expect(screen.getByRole('button', { name: 'Tag accounts (1)' })).toBeInTheDocument()
    expect(screen.getByText('Tagged: @friend')).toBeInTheDocument()
  })

  it('shows a refusal from the server on the main screen', async () => {
    const user = userEvent.setup()
    const { view, rerender } = setup()
    await user.click(screen.getByRole('button', { name: 'Tag accounts' }))
    rerender(view('That time has passed'))
    expect(await screen.findByText('That time has passed')).toBeInTheDocument()
    expect(screen.getByLabelText('Caption')).toBeInTheDocument()
  })
})
