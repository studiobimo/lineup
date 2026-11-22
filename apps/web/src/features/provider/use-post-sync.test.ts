import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PublishedPost, ScheduledPost } from 'lineup-contract'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { CellPost } from '@/features/planner/board-schema'

import { loadStrings } from '@/i18n/load-strings'
import { createPlannerStore } from '@/features/planner/planner-store'
import type { Board, History, ImageRecord } from '@/features/planner/board-store'

import { pollInterval, postChanges, postNotices, usePostSync } from './use-post-sync'

const mocks = vi.hoisted(() => ({
  store: undefined as undefined | { getState: () => unknown },
  scheduled: [] as unknown[],
  published: 0,
  listFails: false,
  toasts: [] as { title: string; actionProps?: unknown }[]
}))

vi.mock('@/features/planner/planner', async () => {
  const { useStore } = await import('zustand')
  return {
    get plannerStore() {
      return mocks.store
    },
    usePlanner: (selector: (state: unknown) => unknown) =>
      useStore(mocks.store as never, selector as never)
  }
})
vi.mock('@/components/ui/toast', () => ({
  toastManager: { add: (toast: { title: string }) => mocks.toasts.push(toast) }
}))
vi.mock('./queries', () => ({
  postsQuery: () => ({ queryKey: ['scheduled'], queryFn: async () => mocks.scheduled }),
  publishedQuery: () => ({
    queryKey: ['published'],
    queryFn: async () => {
      mocks.published += 1
      if (mocks.listFails) throw new Error('down')
      return [] as PublishedPost[]
    }
  })
}))

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

describe('syncing a post that goes out', () => {
  it('drops the cell once the provider list is read again, and says so', async () => {
    const { board, store, calls, toasts } = await syncHarness({
      stored: 'scheduled',
      latest: { id: 'post', status: 'published', url: 'https://example.com/p' }
    })
    await waitFor(() => expect(board().grid).toEqual(['two']))
    expect(board().posts).toEqual({})
    expect(calls.published).toBeGreaterThanOrEqual(1)
    expect(toasts).toEqual([
      expect.objectContaining({ title: 'Your post is published.', actionProps: expect.anything() })
    ])
    expect(store.getState().images).not.toHaveProperty('one')
  })

  it('cleans a board saved with a published cell, without a notice', async () => {
    const { board, toasts } = await syncHarness({ stored: 'published' })
    await waitFor(() => expect(board().grid).toEqual(['two']))
    expect(toasts).toEqual([])
  })

  it('leaves a failed cell and a scheduled one alone', async () => {
    const { board, calls } = await syncHarness({ stored: 'failed' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(board().grid).toEqual(['one', 'two'])
    expect(calls.published).toBe(0)
  })

  it('keeps the cell when the provider list cannot be read', async () => {
    const { board } = await syncHarness({ stored: 'published', listFails: true })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(board().grid).toEqual(['one', 'two'])
  })
})

type Harness = { stored: CellPost['status']; latest?: ScheduledPost; listFails?: boolean }

async function syncHarness({ stored, latest, listFails = false }: Harness) {
  const saved: Board = {
    tray: [],
    grid: ['one', 'two'],
    posts: { one: { ...post, status: stored, failure: undefined } }
  }
  const fake = {
    loadBoard: async () => saved,
    saveBoard: async () => undefined,
    loadHistory: async (): Promise<History> => ({ past: [], future: [] }),
    saveHistory: async () => undefined,
    listImages: async () =>
      ['one', 'two'].map((id): ImageRecord => ({
        id,
        width: 1,
        height: 1,
        createdAt: '2026-11-01T12:00:00Z'
      })),
    deleteImages: async () => undefined
  }
  await loadStrings('provider')
  const store = createPlannerStore(fake as never)
  await store.getState().load()
  mocks.store = store
  mocks.published = 0
  mocks.listFails = listFails
  mocks.toasts = []
  mocks.scheduled = [latest ?? { id: 'post', status: stored }]
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  renderHook(() => usePostSync('account'), { wrapper })
  return {
    store,
    board: () => store.getState().board,
    calls: {
      get published() {
        return mocks.published
      }
    },
    get toasts() {
      return mocks.toasts
    }
  }
}
