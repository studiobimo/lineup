import { QueryClient } from '@tanstack/react-query'
import { publishDelaySchema } from 'lineup-contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CellPost } from '@/features/planner/board-schema'

import { postShape, publishDelayEvent, reportPublished } from './publish-telemetry'

const mocks = vi.hoisted(() => ({
  posts: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[]
}))

vi.mock('@/features/planner/planner', () => ({
  plannerStore: {
    getState: () => ({
      board: { tray: [], grid: [], posts: mocks.posts },
      updatePosts: (changes: Record<string, unknown>) => {
        mocks.updates.push(changes)
        Object.assign(mocks.posts, changes)
      }
    })
  }
}))

const media = { kind: 'carousel', images: 2, videos: 1, totalBytes: 9000 } as const

const published: CellPost = {
  id: 'zernio-post-id',
  accountId: 'account-id',
  scheduledFor: '2030-01-01T10:00:00.000Z',
  timeZone: 'Europe/London',
  caption: 'A private caption',
  status: 'published',
  url: 'https://www.instagram.com/p/secret/',
  publishedAt: '2030-01-01T10:04:10.000Z',
  media: { ...media, largestVideoBytes: 7000, largestVideoSeconds: 12 }
}

const sent = vi.fn()
const settled = () => new Promise((resolve) => setTimeout(resolve, 20))

function client() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(
    ['provider', 'accounts'],
    [{ id: 'account-id', username: 'Studio.Bimo' }]
  )
  return queryClient
}

beforeEach(() => {
  sent.mockReset()
  sent.mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', sent)
  mocks.posts = { cell: { ...published }, other: { ...published, id: 'two' } }
  mocks.updates = []
})

const telemetry = () =>
  sent.mock.calls.filter(([input]) =>
    String(input instanceof Request ? input.url : input).includes('/telemetry/')
  )
const bodies = () =>
  telemetry().map(([, init]) => JSON.parse(String((init as RequestInit).body)) as object)

describe('the shape of a post', () => {
  it('counts the images and videos and adds up the bytes', () => {
    const copies = [
      { type: 'image/jpeg', size: 100 },
      { type: 'video/mp4', size: 5000 },
      { type: 'video/quicktime', size: 9000 }
    ]
    expect(postShape(copies, [undefined, 10, 30])).toEqual({
      kind: 'carousel',
      images: 1,
      videos: 2,
      totalBytes: 14_100,
      largestVideoBytes: 9000,
      largestVideoSeconds: 30
    })
  })

  it('calls one image an image and one video a reel', () => {
    expect(postShape([{ type: 'image/png', size: 1 }], [undefined]).kind).toBe('image')
    expect(postShape([{ type: 'video/mp4', size: 1 }], [3]).kind).toBe('reel')
  })
})

describe('the event for a published post', () => {
  it('is built from the post and its shape, and passes the contract', () => {
    const event = publishDelayEvent(published, '@Studio.Bimo')
    expect(event).toMatchObject({
      ...published.media,
      scheduledFor: published.scheduledFor,
      publishedAt: published.publishedAt,
      delaySeconds: 250,
      account: 'studio.bimo'
    })
    expect(publishDelaySchema.safeParse(event).success).toBe(true)
  })

  it('has a fresh random id each time, and nothing of the post, the account or the caption', () => {
    const [one, two] = [publishDelayEvent(published, 'a'), publishDelayEvent(published, 'a')]
    expect(one?.eventId).not.toBe(two?.eventId)
    expect(Object.keys(one ?? {}).toSorted()).toEqual(
      [...Object.keys(publishDelaySchema.shape)].filter((key) => key in (one ?? {})).toSorted()
    )
    const text = JSON.stringify(one)
    for (const secret of [
      'zernio-post-id',
      'account-id',
      'private caption',
      'instagram.com',
      'London'
    ]) {
      expect(text).not.toContain(secret)
    }
  })

  it('never goes below zero, and leaves out a handle that is not one', () => {
    const early = { ...published, publishedAt: '2030-01-01T09:59:00.000Z' }
    expect(publishDelayEvent(early, 'has spaces')).toMatchObject({ delaySeconds: 0 })
    expect(publishDelayEvent(early, 'has spaces')).not.toHaveProperty('account')
  })

  it('is not made for a post scheduled before this, or one with no time from the provider', () => {
    expect(publishDelayEvent({ ...published, media: undefined }, 'a')).toBeUndefined()
    expect(publishDelayEvent({ ...published, publishedAt: undefined }, 'a')).toBeUndefined()
  })
})

describe('reporting published posts', () => {
  it('sends one event per post, to the telemetry route and nowhere else', async () => {
    reportPublished(['cell', 'other'], client(), 'account-id')
    await settled()
    expect(sent).toHaveBeenCalledTimes(2)
    for (const [input] of sent.mock.calls) {
      expect(String(input instanceof Request ? input.url : input)).toContain(
        '/api/v1/telemetry/publish-delay'
      )
    }
    expect(bodies()[0]).toMatchObject({ kind: 'carousel', account: 'studio.bimo' })
  })

  it('sends a post once: it is marked first, so the next pass and a reload skip it', async () => {
    reportPublished(['cell'], client(), 'account-id')
    expect(mocks.updates[0]).toMatchObject({ cell: { reported: true } })
    reportPublished(['cell'], client(), 'account-id')
    await settled()
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('skips a post that is not published', async () => {
    mocks.posts = { cell: { ...published, status: 'scheduled' } }
    reportPublished(['cell'], client(), 'account-id')
    await settled()
    expect(sent).not.toHaveBeenCalled()
  })

  it('sends without an account when the account is not among the accounts', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['provider', 'accounts'], [])
    reportPublished(['cell'], queryClient, 'account-id')
    await settled()
    expect(bodies()[0]).not.toHaveProperty('account')
  })

  it('ignores a failed send, a refused one and a throwing one', async () => {
    sent.mockRejectedValueOnce(new TypeError('offline'))
    sent.mockResolvedValueOnce(new Response('no', { status: 429 }))
    expect(() => reportPublished(['cell', 'other'], client(), 'account-id')).not.toThrow()
    sent.mockImplementation(() => {
      throw new Error('boom')
    })
    mocks.posts = { cell: { ...published } }
    expect(() => reportPublished(['cell'], client(), 'account-id')).not.toThrow()
    await settled()
  })
})
