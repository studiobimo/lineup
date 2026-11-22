import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PublishedPost } from 'lineup-contract'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

const mocks = vi.hoisted(() => ({ board: { tray: [], grid: [] } as unknown }))
vi.mock('@/features/planner/planner', () => ({
  plannerStore: { getState: () => ({ board: mocks.board }) }
}))
vi.mock('./published-picture', () => ({ PublishedPicture: () => <div data-testid="picture" /> }))

import { dismissNotices, findSwaps, noteOrder, orderNoticeStore } from './order-notice'
import { OrderNoticeDialog } from './order-notice-dialog'

const scheduled = (id: string, minutes: number, extra: { url?: string } = {}) => ({
  id,
  scheduledFor: new Date(Date.UTC(2030, 0, 1, 10, minutes)).toISOString(),
  ...extra
})
const live = (id: string, minutes: number): PublishedPost => ({
  id,
  publishedAt: new Date(Date.UTC(2030, 0, 1, 10, minutes)).toISOString()
})
const boardOf = (...posts: ReturnType<typeof scheduled>[]) => ({
  tray: [],
  grid: posts.map(({ id }) => id),
  posts: Object.fromEntries(
    posts.map((post) => [
      post.id,
      {
        ...post,
        accountId: 'a',
        timeZone: 'UTC',
        caption: 'a private caption',
        status: 'published'
      }
    ])
  )
})

describe('finding posts that went live out of order', () => {
  it('finds nothing when they went live in the order they were scheduled', () => {
    expect(
      findSwaps([scheduled('a', 0), scheduled('b', 10)], [live('a', 1), live('b', 11)])
    ).toEqual([])
  })

  it('finds a post that went live after one scheduled later', () => {
    const swaps = findSwaps([scheduled('a', 0), scheduled('b', 10)], [live('a', 20), live('b', 12)])
    expect(swaps.map(({ first, second }) => [first.id, second.id])).toEqual([['a', 'b']])
  })

  it('ignores posts made outside Lineup, and ones without a time', () => {
    const outside = [live('x', 0), live('y', 30), { id: 'a' }]
    expect(findSwaps([scheduled('a', 5), scheduled('b', 10)], [...outside, live('b', 12)])).toEqual(
      []
    )
  })

  it('matches a post by its link when the ids differ', () => {
    const post = scheduled('a', 0, { url: 'https://example.com/p/1' })
    const swaps = findSwaps(
      [post, scheduled('b', 10)],
      [{ ...live('theirs', 20), url: post.url }, live('b', 12)]
    )
    expect(swaps[0].first.id).toBe('theirs')
  })
})

describe('the notice', () => {
  beforeAll(() => loadStrings('provider'))
  beforeEach(() => {
    localStorage.clear()
    orderNoticeStore.setState({ recent: [], notices: [], seen: [] })
  })

  it('is recorded as posts go, with no captions, and survives a reload', () => {
    mocks.board = boardOf(scheduled('a', 0), scheduled('b', 10))
    noteOrder(['a', 'b'], [live('a', 20), live('b', 12)])
    expect(orderNoticeStore.getState().notices).toHaveLength(1)
    const stored = localStorage.getItem('order-notice') ?? ''
    expect(stored).not.toContain('private caption')
    expect(JSON.parse(stored).notices).toHaveLength(1)
  })

  it('notices a swap whose halves leave the board in different syncs', () => {
    mocks.board = boardOf(scheduled('b', 10))
    noteOrder(['b'], [live('b', 12)])
    expect(orderNoticeStore.getState().notices).toEqual([])
    mocks.board = boardOf(scheduled('a', 0))
    noteOrder(['a'], [live('a', 20), live('b', 12)])
    expect(orderNoticeStore.getState().notices).toHaveLength(1)
  })

  it('says nothing for posts that went out in order', () => {
    mocks.board = boardOf(scheduled('a', 0), scheduled('b', 10))
    noteOrder(['a', 'b'], [live('a', 2), live('b', 12)])
    expect(orderNoticeStore.getState().notices).toEqual([])
  })

  it('is not recorded twice, nor again once dismissed', () => {
    mocks.board = boardOf(scheduled('a', 0), scheduled('b', 10))
    const list = [live('a', 20), live('b', 12)]
    noteOrder(['a', 'b'], list)
    noteOrder(['a', 'b'], list)
    expect(orderNoticeStore.getState().notices).toHaveLength(1)
    dismissNotices()
    noteOrder(['a', 'b'], list)
    expect(orderNoticeStore.getState().notices).toEqual([])
    expect(JSON.parse(localStorage.getItem('order-notice') ?? '').seen).toEqual(['a|b'])
  })

  it('shows a dialog that explains, and is dismissed for good', async () => {
    const user = userEvent.setup()
    mocks.board = boardOf(scheduled('a', 0), scheduled('b', 10))
    noteOrder(['a', 'b'], [live('a', 20), live('b', 12)])
    render(<OrderNoticeDialog posts={[live('a', 20), live('b', 12)]} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/orders your posts by when they actually went live/)).toBeVisible()
    expect(screen.getAllByTestId('picture')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(orderNoticeStore.getState().notices).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('ignores a damaged stored value', async () => {
    localStorage.setItem('order-notice', '{"notices":[{"first":1}],"seen":3}')
    vi.resetModules()
    const { orderNoticeStore: fresh } = await import('./order-notice')
    expect(fresh.getState()).toEqual({ recent: [], notices: [], seen: [] })
  })
})
