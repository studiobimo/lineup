import type { PublishedPost } from 'lineup-contract'
import { describe, expect, it } from 'vitest'

import { feedOrder } from './published-order'

const at = (day: number) => Date.parse(`2030-01-${String(day).padStart(2, '0')}T10:00:00Z`)
const post = (id: string, day?: number): PublishedPost => ({
  id,
  publishedAt: day ? new Date(at(day)).toISOString() : undefined
})
const ids = (feed: ReturnType<typeof feedOrder>) =>
  feed.map((entry) => ('cell' in entry ? `cell:${entry.cell}` : entry.post.id))

describe('the published feed', () => {
  it('puts a board cell among the provider’s posts by the time it went out', () => {
    const feed = feedOrder([{ id: 'mine', at: at(5) }], [post('new', 9), post('old', 2)])
    expect(ids(feed)).toEqual(['new', 'cell:mine', 'old'])
  })

  it('puts a cell that is newest first, right after the planned cells', () => {
    expect(ids(feedOrder([{ id: 'mine', at: at(20) }], [post('new', 9)]))).toEqual([
      'cell:mine',
      'new'
    ])
  })

  it('orders several cells newest first, and keeps the provider’s order', () => {
    const cells = [
      { id: 'early', at: at(3) },
      { id: 'late', at: at(8) }
    ]
    expect(ids(feedOrder(cells, [post('x', 9), post('y', 1)]))).toEqual([
      'x',
      'cell:late',
      'cell:early',
      'y'
    ])
  })

  it('does not let a post with no time jump ahead of a cell', () => {
    expect(ids(feedOrder([{ id: 'mine', at: at(1) }], [post('unknown')]))).toEqual([
      'cell:mine',
      'unknown'
    ])
  })

  it('shows the cells alone with no connection, and a cell once', () => {
    const cells = [
      { id: 'a', at: at(1) },
      { id: 'b', at: at(2) }
    ]
    expect(ids(feedOrder(cells, []))).toEqual(['cell:b', 'cell:a'])
  })
})
