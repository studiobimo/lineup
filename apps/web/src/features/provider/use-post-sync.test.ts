import { describe, expect, it } from 'vitest'

import type { CellPost } from '@/features/planner/board-schema'

import { pollInterval, postChanges, postNotices } from './use-post-sync'

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

describe('noticing a change', () => {
  const live = (status: CellPost['status']): CellPost => ({ ...post, status, failure: undefined })
  const on = (status: CellPost['status']) => ({ ...board, posts: { cell: live(status) } })

  it('reports a post that went out, and one that failed', () => {
    expect(postNotices(on('publishing'), { cell: live('published') })).toEqual([
      { kind: 'published', post: live('published') }
    ])
    expect(postNotices(on('publishing'), { cell: live('failed') })).toEqual([
      { kind: 'failed', post: live('failed') }
    ])
  })

  it('stays quiet for a post already published, or still waiting', () => {
    expect(postNotices(on('published'), { cell: live('published') })).toEqual([])
    expect(postNotices(on('scheduled'), { cell: live('publishing') })).toEqual([])
  })

  it('stays quiet for a post cancelled elsewhere', () => {
    expect(postNotices(on('scheduled'), { cell: undefined })).toEqual([])
  })
})

describe('how often to look', () => {
  const now = Date.parse('2030-01-01T10:00:00.000Z')
  const posts = (status: CellPost['status'], scheduledFor = post.scheduledFor) => ({
    cell: { ...post, status, scheduledFor }
  })

  it('looks every 10 seconds while a post is publishing or due', () => {
    expect(pollInterval(posts('publishing'), now)).toBe(10_000)
    expect(pollInterval(posts('scheduled'), now)).toBe(10_000)
  })

  it('looks every minute otherwise', () => {
    expect(pollInterval(posts('scheduled', '2030-01-02T10:00:00.000Z'), now)).toBe(60_000)
    expect(pollInterval(posts('published'), now)).toBe(60_000)
    expect(pollInterval(undefined, now)).toBe(60_000)
  })
})
