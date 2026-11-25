import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderRequestError } from './api'
import { MoveFailure, movePosts } from './move-posts'

const MINUTE = 60_000
const calls: { id: string; scheduledFor: string }[] = []
const updates: Record<string, unknown>[] = []
const failing = new Set<string>()

const posts = Object.fromEntries(
  ['a', 'b', 'c'].map((cell) => [
    cell,
    { id: `post-${cell}`, timeZone: 'Europe/London', status: 'scheduled', scheduledFor: '' }
  ])
)

vi.mock('@/features/planner/planner', () => ({
  plannerStore: {
    getState: () => ({
      board: { posts },
      updatePosts: (change: Record<string, unknown>) => updates.push(change)
    })
  }
}))

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  providerApi: {
    'scheduled-posts': {
      ':id': {
        $patch: ({ param, json }: { param: { id: string }; json: { scheduledFor: string } }) => {
          calls.push({ id: param.id, scheduledFor: json.scheduledFor })
          const ok = !failing.has(param.id)
          return Promise.resolve({
            ok,
            status: ok ? 200 : 500,
            json: () => Promise.resolve({ id: param.id, scheduledFor: json.scheduledFor })
          })
        }
      }
    }
  }
}))

const move = (cell: string, minutes: number) => ({ cell, from: 0, to: minutes * MINUTE })

describe('movePosts', () => {
  beforeEach(() => {
    calls.length = 0
    updates.length = 0
    failing.clear()
  })

  it('moves the latest post first and updates the board after each', async () => {
    await movePosts([move('a', 1), move('b', 2)])
    expect(calls.map(({ id }) => id)).toEqual(['post-b', 'post-a'])
    expect(updates).toHaveLength(2)
  })

  it('stops at the first failure and says which moved and which did not', async () => {
    failing.add('post-b')
    const failure = await movePosts([move('a', 1), move('b', 2), move('c', 3)]).catch(
      (error: unknown) => error
    )
    expect(failure).toBeInstanceOf(MoveFailure)
    const { moved, left, reason } = failure as MoveFailure
    expect(moved.map(({ cell }) => cell)).toEqual(['c'])
    expect(left.map(({ cell }) => cell)).toEqual(['b', 'a'])
    expect(reason).toBeInstanceOf(ProviderRequestError)
    expect(updates).toHaveLength(1)
  })
})
