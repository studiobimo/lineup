import { plannerStore } from '@/features/planner/planner'

import { answer, providerApi } from './api'
import type { Move } from './publish-timing'

export class MoveFailure extends Error {
  readonly moved: Move[]
  readonly left: Move[]
  readonly reason: unknown

  constructor(moved: Move[], left: Move[], reason: unknown) {
    super('move_failed')
    this.name = 'MoveFailure'
    this.moved = moved
    this.left = left
    this.reason = reason
  }
}

async function movePost({ cell, to }: Move) {
  const post = plannerStore.getState().board.posts?.[cell]
  if (!post) return
  const fresh = await answer(
    providerApi['scheduled-posts'][':id'].$patch({
      param: { id: post.id },
      json: { scheduledFor: new Date(to).toISOString(), timeZone: post.timeZone }
    })
  )
  plannerStore.getState().updatePosts({ [cell]: { ...post, ...fresh, failure: fresh.failure } })
}

export async function movePosts(moves: Move[]) {
  const latestFirst = [...moves].reverse()
  for (const [index, move] of latestFirst.entries()) {
    try {
      await movePost(move)
    } catch (reason) {
      throw new MoveFailure(latestFirst.slice(0, index), latestFirst.slice(index), reason)
    }
  }
}
