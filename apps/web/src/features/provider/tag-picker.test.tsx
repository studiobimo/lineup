import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { TagPicker } from './tag-picker'
import { toUserTags, type TagDraft } from './tags'

vi.mock('@/features/planner/planner', () => ({
  usePlanner: (select: (state: object) => unknown) => select({ images: {} })
}))
vi.mock('@/features/planner/thumbnail', () => ({
  PictureImage: () => null,
  Thumbnail: () => null
}))

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

const pendingName = () => screen.getByRole('textbox', { name: 'Username for the new tag' })

async function tag(user: ReturnType<typeof userEvent.setup>, username: string) {
  await user.click(screen.getByTestId('tag-picture'))
  await user.type(pendingName(), `${username}{Enter}`)
}

describe('TagPicker', () => {
  beforeAll(() => loadStrings('provider'))
  beforeEach(() => {
    latest = []
  })

  it('places a pending point first and adds the tag only when a username is confirmed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('tag-picture'))
    expect(pendingName()).toHaveFocus()
    expect(screen.getByTestId('pending-tag')).toBeInTheDocument()
    expect(latest).toEqual([])
    await user.type(pendingName(), '@Some.One{Enter}')
    expect(toUserTags(latest)).toEqual([{ username: 'some.one', x: 0.5, y: 0.5, mediaIndex: 0 }])
    expect(screen.queryByTestId('pending-tag')).toBeNull()
  })

  it('confirms with the button, which stays disabled while the name is empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('tag-picture'))
    expect(screen.getByRole('button', { name: 'Add the tag' })).toBeDisabled()
    await user.type(pendingName(), 'friend')
    await user.click(screen.getByRole('button', { name: 'Add the tag' }))
    expect(latest).toHaveLength(1)
  })

  it('discards the pending point on Escape, on clicking elsewhere and when left empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId('tag-picture'))
    await user.type(pendingName(), 'nobody{Escape}')
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    await user.click(screen.getByTestId('tag-picture'))
    await user.type(pendingName(), 'nobody')
    await user.click(document.body)
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    await user.click(screen.getByTestId('tag-picture'))
    await user.click(document.body)
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    expect(latest).toEqual([])
  })

  it('keeps one row for the pending tag, with a hint while there is none', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('Tap the picture to add a tag.')).toBeInTheDocument()
    await user.click(screen.getByTestId('tag-picture'))
    expect(screen.queryByText('Tap the picture to add a tag.')).toBeNull()
    await user.type(pendingName(), '{Escape}')
    expect(screen.getByText('Tap the picture to add a tag.')).toBeInTheDocument()
  })

  it('drops a committed tag whose username is emptied', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tag(user, 'friend')
    await user.clear(screen.getByRole('textbox', { name: 'Username of tag 1' }))
    await user.click(document.body)
    expect(latest).toEqual([])
  })

  it('moves a tag with the arrow keys, ten times as far with Shift', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tag(user, 'friend')
    const marker = screen.getByRole('button', { name: /^@friend, 50% from the left/ })
    marker.focus()
    await user.keyboard('{ArrowRight}')
    expect(latest[0]).toMatchObject({ x: 0.51, y: 0.5 })
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(latest[0]).toMatchObject({ x: 0.51, y: 0.4 })
  })

  it('places a point where the picture is clicked and moves its tag by dragging', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const picture = screen.getByTestId('tag-picture')
    picture.parentElement!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect
    fireEvent.click(picture, { clientX: 50, clientY: 50, detail: 1 })
    await user.type(pendingName(), 'friend{Enter}')
    expect(latest[0]).toMatchObject({ x: 0.25, y: 0.5 })
    const marker = screen.getByRole('button', { name: /^@friend/ })
    fireEvent.pointerDown(marker, { isPrimary: true, button: 0, pointerId: 1 })
    fireEvent.pointerMove(marker, { clientX: 400, clientY: -10 })
    expect(latest[0]).toMatchObject({ x: 1, y: 0 })
  })

  it('removes a tag from the list and from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tag(user, 'friend')
    await user.click(screen.getByRole('button', { name: 'Remove tag 1' }))
    expect(latest).toEqual([])
    await tag(user, 'friend')
    screen.getByRole('button', { name: /^@friend/ }).focus()
    await user.keyboard('{Delete}')
    expect(latest).toEqual([])
  })

  it('keeps tags per slide, and lists usernames only on a video', async () => {
    const user = userEvent.setup()
    render(<Harness slides={[image, video]} />)
    await tag(user, 'friend')
    await user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    expect(screen.queryByTestId('tag-picture')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add an account' }))
    expect(pendingName()).toHaveFocus()
    await user.type(pendingName(), 'filmer{Enter}')
    expect(toUserTags(latest)).toEqual([
      { username: 'friend', x: 0.5, y: 0.5, mediaIndex: 0 },
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
      await user.type(pendingName(), `a${count}{Enter}`)
    }
    expect(screen.queryByRole('button', { name: 'Add an account' })).toBeNull()
    expect(screen.getByText(/most Instagram allows/)).toBeInTheDocument()
    expect(latest).toHaveLength(20)
  }, 30_000)
})
