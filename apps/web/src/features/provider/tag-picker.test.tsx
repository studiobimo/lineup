import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { TagPicker } from './tag-picker'
import { toUserTags, type TagDraft } from './tags'

vi.mock('@/features/planner/planner', () => ({
  usePlanner: (select: (state: object) => unknown) => select({ images: {} })
}))
vi.mock('@/features/planner/thumbnail', () => ({ PictureImage: () => null }))

const image = { id: 'a', video: false }
const video = { id: 'v', video: true }

let latest: TagDraft[] = []

function Harness({ slides = [image] }: { slides?: { id: string; video: boolean }[] }) {
  const [tags, setTags] = useState<TagDraft[]>([])
  return (
    <TagPicker
      slides={slides}
      tags={tags}
      onChange={(next) => {
        latest = next
        setTags(next)
      }}
    />
  )
}

describe('TagPicker', () => {
  beforeAll(() => loadStrings('provider'))

  it('adds a tag where the picture is clicked and takes a username without the @', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('tag-picture'))
    const name = screen.getByRole('textbox', { name: 'Username of tag 1' })
    expect(name).toHaveFocus()
    await user.type(name, '@Some.One')
    expect(toUserTags(latest)).toEqual([{ username: 'some.one', x: 0.5, y: 0.5, mediaIndex: 0 }])
  })

  it('moves a tag with the arrow keys, ten times as far with Shift', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('tag-picture'))
    const marker = screen.getByRole('button', { name: /^Tag 1, 50% from the left/ })
    marker.focus()
    await user.keyboard('{ArrowRight}')
    expect(latest[0]).toMatchObject({ x: 0.51, y: 0.5 })
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(latest[0]).toMatchObject({ x: 0.51, y: 0.4 })
  })

  it('moves a tag by dragging it', () => {
    render(<Harness />)
    const picture = screen.getByTestId('tag-picture')
    picture.parentElement!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect
    fireEvent.click(picture, { clientX: 50, clientY: 50, detail: 1 })
    expect(latest[0]).toMatchObject({ x: 0.25, y: 0.5 })
    const marker = screen.getByRole('button', { name: /^Tag 1/ })
    fireEvent.pointerDown(marker, { isPrimary: true, button: 0, pointerId: 1 })
    fireEvent.pointerMove(marker, { clientX: 400, clientY: -10 })
    expect(latest[0]).toMatchObject({ x: 1, y: 0 })
  })

  it('removes a tag from the list and from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('tag-picture'))
    await user.click(screen.getByRole('button', { name: 'Remove tag 1' }))
    expect(latest).toEqual([])
    await user.click(screen.getByTestId('tag-picture'))
    screen.getByRole('button', { name: /^Tag 1/ }).focus()
    await user.keyboard('{Delete}')
    expect(latest).toEqual([])
  })

  it('keeps tags per slide, and lists usernames only on a video', async () => {
    const user = userEvent.setup()
    render(<Harness slides={[image, video]} />)
    await user.click(screen.getByTestId('tag-picture'))
    await user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    expect(screen.queryByTestId('tag-picture')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add an account' }))
    await user.type(screen.getByRole('textbox'), 'filmer')
    expect(toUserTags(latest)).toEqual([
      { username: '', x: 0.5, y: 0.5, mediaIndex: 0 },
      { username: 'filmer', mediaIndex: 1 }
    ])
    await user.click(screen.getByRole('button', { name: /^Slide 1/ }))
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('stops at twenty tags', async () => {
    const user = userEvent.setup()
    render(<Harness slides={[video]} />)
    for (let count = 0; count < 20; count += 1) {
      await user.click(screen.getByRole('button', { name: 'Add an account' }))
    }
    expect(screen.getByRole('button', { name: 'Add an account' })).toBeDisabled()
    expect(latest).toHaveLength(20)
  })
})
