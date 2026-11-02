import { describe, expect, it } from 'vitest'

import type { CellPost } from '@/features/planner/board-schema'

import { postChanges } from './use-post-sync'

const post: CellPost = {
  id: 'post',
  accountId: 'account',
  scheduledFor: '2030-01-01T10:00:00.000Z',
  timeZone: 'Europe/London',
  caption: 'Hello',
  status: 'failed',
  failure: 'It was too wide'
}
const board = { tray: [], grid: ['cell'], posts: { cell: post } }

describe('the latest on a post', () => {
  it('replaces what the board had, and clears a failure that has passed', () => {
    const latest = [{ id: 'post', status: 'published' as const, url: 'https://example.com/p' }]
    expect(postChanges(board, latest).cell).toEqual({
      ...post,
      status: 'published',
      url: 'https://example.com/p',
      failure: undefined
    })
  })

  it('frees the cell of a post cancelled elsewhere', () => {
    const changes = postChanges(board, [{ id: 'post', status: 'cancelled' }])
    expect(changes).toHaveProperty('cell', undefined)
  })

  it('leaves alone a post the provider no longer lists', () => {
    expect(postChanges(board, [])).toEqual({})
  })
})
