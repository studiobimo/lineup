import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { SlideViewer } from './slide-viewer'
import { toUserTags, type TagDraft } from './tags'

vi.mock('@/features/planner/planner', () => ({ usePlanner: () => undefined }))
vi.mock('@/features/planner/thumbnail', () => ({
  PictureImage: () => null,
  Thumbnail: () => null
}))

const image = { id: 'a', video: false }
const video = { id: 'v', video: true }

let latest: TagDraft[] = []

function Harness({
  slides = [image],
  opened = 0
}: {
  slides?: { id: string; video: boolean }[]
  opened?: number
}) {
  const [tags, setTags] = useState<TagDraft[]>([])
  const [index, setIndex] = useState(opened)
  return (
    <>
      <SlideViewer
        slides={slides}
        index={index}
        onIndexChange={setIndex}
        tagging={{
          tags,
          onChange: (next) => {
            latest = next
            setTags(next)
          }
        }}
      />
      <button type="button">elsewhere</button>
    </>
  )
}

const pendingName = () => screen.findByRole('textbox', { name: 'Username for the new tag' })
const surface = () => screen.getByTestId('tag-picture')

async function tag(user: ReturnType<typeof userEvent.setup>, username: string) {
  await user.click(surface())
  await user.type(await pendingName(), `${username}{Enter}`)
}

beforeAll(() => loadStrings('provider'))
beforeEach(() => {
  latest = []
})

describe('tagging on the picture', () => {
  it('places a pending point first and adds the tag only when a username is confirmed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(surface())
    expect(await pendingName()).toHaveFocus()
    expect(screen.getByTestId('pending-tag')).toBeInTheDocument()
    expect(latest).toEqual([])
    await user.type(await pendingName(), '@Some.One{Enter}')
    expect(toUserTags(latest)).toEqual([{ username: 'some.one', x: 0.5, y: 0.5, mediaIndex: 0 }])
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    expect(surface()).toHaveFocus()
  })

  it('confirms with the button, which stays disabled while the name is empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(surface())
    expect(await screen.findByRole('button', { name: 'Add the tag' })).toBeDisabled()
    await user.type(await pendingName(), 'friend')
    await user.click(screen.getByRole('button', { name: 'Add the tag' }))
    expect(latest).toHaveLength(1)
  })

  it('drops the pending point on Escape, on tapping elsewhere and on an empty name', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(surface())
    await user.type(await pendingName(), 'nobody{Escape}')
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    await user.click(surface())
    await user.type(await pendingName(), 'nobody')
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    await user.click(surface())
    await user.type(await pendingName(), '{Enter}')
    expect(screen.queryByTestId('pending-tag')).toBeNull()
    expect(latest).toEqual([])
  })

  it('shows a hint on the picture while there are no tags', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('Tap the picture to tag someone.')).toBeInTheDocument()
    await tag(user, 'friend')
    expect(screen.queryByText('Tap the picture to tag someone.')).toBeNull()
  })

  it('opens the username field from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    surface().focus()
    await user.keyboard('{Enter}')
    expect(await pendingName()).toHaveFocus()
    await user.keyboard('friend{Enter}')
    expect(toUserTags(latest)).toEqual([{ username: 'friend', x: 0.5, y: 0.5, mediaIndex: 0 }])
  })
})

describe('tagging on the picture, moving and removing tags', () => {
  it('moves a tag with the arrow keys, ten times as far with Shift', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tag(user, 'friend')
    screen.getByRole('button', { name: /^@friend, 50% from the left/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(latest[0]).toMatchObject({ x: 0.51, y: 0.5 })
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(latest[0]).toMatchObject({ x: 0.51, y: 0.4 })
  })

  it('places a point where the picture is tapped and moves its tag by dragging', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    surface().parentElement!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect
    fireEvent.click(surface(), { clientX: 50, clientY: 50, detail: 1 })
    await user.type(await pendingName(), 'friend{Enter}')
    expect(latest[0]).toMatchObject({ x: 0.25, y: 0.5 })
    const marker = screen.getByRole('button', { name: /^@friend/ })
    fireEvent.pointerDown(marker, { isPrimary: true, button: 0, pointerId: 1 })
    fireEvent.pointerMove(marker, { clientX: 400, clientY: -10 })
    expect(latest[0]).toMatchObject({ x: 1, y: 0 })
  })

  it('removes a tag with its button and with Delete', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await tag(user, 'friend')
    await user.click(screen.getByRole('button', { name: /^@friend/ }))
    await user.click(screen.getByRole('button', { name: 'Remove @friend' }))
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
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(screen.queryByTestId('tag-picture')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add an account' }))
    expect(await pendingName()).toHaveFocus()
    await user.type(await pendingName(), 'filmer{Enter}')
    expect(toUserTags(latest)).toEqual([
      { username: 'friend', x: 0.5, y: 0.5, mediaIndex: 0 },
      { username: 'filmer', mediaIndex: 1 }
    ])
    expect(screen.getByText('@filmer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(screen.getAllByRole('button', { name: /^@/ })).toHaveLength(1)
  })

  it('drops a pending point when the slide changes', async () => {
    const user = userEvent.setup()
    render(<Harness slides={[image, video]} />)
    await user.click(surface())
    await pendingName()
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(latest).toEqual([])
  })

  it('stops at twenty tags', async () => {
    const user = userEvent.setup()
    render(<Harness slides={[video]} />)
    for (let count = 0; count < 20; count += 1) {
      await user.click(screen.getByRole('button', { name: 'Add an account' }))
      await user.type(await pendingName(), `a${count}{Enter}`)
    }
    expect(screen.queryByRole('button', { name: 'Add an account' })).toBeNull()
    expect(screen.getByText(/most Instagram allows/)).toBeInTheDocument()
    expect(latest).toHaveLength(20)
  }, 30_000)
})
