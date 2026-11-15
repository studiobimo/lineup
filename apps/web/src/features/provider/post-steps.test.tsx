import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { PostSteps } from './post-steps'

vi.mock('./post-thumbnail', () => ({ PostThumbnail: () => <div data-testid="thumbnail" /> }))
vi.mock('./tag-picker', () => ({ TagPicker: () => <p>picker</p> }))
vi.mock('./use-misordered', () => ({ isMisordered: () => false }))
vi.mock('@/features/planner/planner', () => ({
  plannerStore: { getState: () => ({ board: {} }) }
}))

const FUTURE = '2999-01-01T10:00'

function setup(problem?: string) {
  const onSubmit = vi.fn(() => Promise.resolve())
  const view = (error?: string) => (
    <PostSteps
      cell="a"
      initial={{ caption: '', when: FUTURE }}
      slides={[{ id: 'a', video: false }]}
      tags={[]}
      submitLabel="Schedule"
      pending={false}
      problem={error}
      onTagsChange={() => undefined}
      onSubmit={onSubmit}
    >
      <p>notice</p>
    </PostSteps>
  )
  return { onSubmit, view, ...render(view(problem)) }
}

describe('PostSteps', () => {
  beforeAll(() => loadStrings('provider'))

  it('shows one step at a time and keeps what was typed when going back', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.getAllByTestId('thumbnail')).toHaveLength(1)
    await user.type(screen.getByLabelText('Caption'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Tag accounts' })).toHaveFocus()
    expect(screen.queryByLabelText('Caption')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('notice')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Caption')).toHaveValue('Hello')
  })

  it('blocks Next while the caption is over the limit', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByLabelText('Caption'))
    await user.paste('x'.repeat(2201))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('submits from the last step only, and returns there when the server refuses', async () => {
    const user = userEvent.setup()
    const { onSubmit, view, rerender } = setup()
    expect(screen.queryByRole('button', { name: 'Schedule' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onSubmit).toHaveBeenCalledWith({ caption: '', when: FUTURE })
    await user.click(screen.getByRole('button', { name: 'Back' }))
    rerender(view('That time has passed'))
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('That time has passed')).toBeInTheDocument()
  })
})
