import { describe, expect, it } from 'vitest'

import { boardSchema } from './board-schema'

const earlier = {
  tray: [],
  grid: ['cell'],
  posts: {
    cell: {
      id: 'post',
      accountId: 'account',
      scheduledFor: '2030-01-01T10:00:00.000Z',
      timeZone: 'Europe/London',
      caption: 'Hello',
      status: 'scheduled'
    }
  }
}

describe('a post on the board, for the publish-delay telemetry (ADR-0026)', () => {
  it('opens a board saved before it had a shape, a time or a mark', () => {
    const board = boardSchema.parse(earlier)
    expect(board.posts?.cell).toEqual(earlier.posts.cell)
  })

  it('keeps the shape, the time and the mark once there', () => {
    const post = {
      ...earlier.posts.cell,
      status: 'published',
      publishedAt: '2030-01-01T10:02:00.000Z',
      reported: true,
      media: { kind: 'reel', images: 0, videos: 1, totalBytes: 10 }
    }
    expect(boardSchema.parse({ ...earlier, posts: { cell: post } }).posts?.cell).toEqual(post)
  })
})
