import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderRequestError } from './api'
import { MissingCopyError, sendPost, VideoLimitError } from './send-post'

const copies = vi.hoisted(() => new Map<string, Blob>())
const records = vi.hoisted(
  () => ({}) as Record<string, { video?: { type: string; duration: number } }>
)

vi.mock('@/features/planner/planner', () => ({
  boardStore: { getPublishCopy: async (id: string) => copies.get(id) },
  plannerStore: { getState: () => ({ images: records }) }
}))

function addVideo(id: string, { duration = 10, size = 1 } = {}) {
  const copy = new Blob(['v'], { type: 'video/quicktime' })
  copies.set(id, size === 1 ? copy : ({ type: copy.type, size } as Blob))
  records[id] = { video: { type: 'video/quicktime', duration } }
}

const post = {
  accountId: 'account',
  caption: 'Hello',
  scheduledFor: '2030-01-01T10:00:00.000Z',
  timeZone: 'Europe/London'
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

interface Sent {
  method: string
  url: string
  body: Record<string, unknown>
  headers: Headers
}

function provider({ loseAnswers = 0, failUploads = new Set<number>() } = {}) {
  const sent: Sent[] = []
  let uploads = 0
  let lost = loseAnswers
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as object) : {}
      sent.push({ method, url, body: body as Sent['body'], headers: new Headers(init?.headers) })
      if (url.includes('/uploads')) {
        const { fileName } = body as { fileName: string }
        return json({ uploadUrl: `https://storage.test/${fileName}`, mediaUrl: `m:${fileName}` })
      }
      if (url.startsWith('https://storage.test')) {
        uploads += 1
        return new Response(null, { status: failUploads.has(uploads) ? 503 : 200 })
      }
      if (lost > 0) {
        lost -= 1
        throw new TypeError('The connection dropped')
      }
      return json({ id: 'post', status: 'scheduled', ...post })
    })
  )
  const posts = () => sent.filter(({ url }) => url.endsWith('/scheduled-posts'))
  return { sent, posts, stored: () => sent.filter(({ method }) => method === 'PUT') }
}

const send = (images: string[], cell = 'cell') =>
  sendPost({ cell, images, post, onImage: () => undefined })

beforeEach(() => {
  localStorage.clear()
  copies.clear()
  for (const id of Object.keys(records)) delete records[id]
  for (const image of ['a', 'b', 'c']) {
    copies.set(image, new Blob(['x'], { type: 'image/jpeg' }))
  }
})

describe('sending a post', () => {
  it('sends the images in album order and returns what the board keeps', async () => {
    const { posts, stored } = provider()
    const linked = await send(['c', 'a', 'b'])
    expect(stored().map(({ url }) => url.split('/').pop())).toEqual(['c.jpeg', 'a.jpeg', 'b.jpeg'])
    expect(posts()[0].body.mediaUrls).toEqual(['m:c.jpeg', 'm:a.jpeg', 'm:b.jpeg'])
    expect(linked).toMatchObject({ id: 'post', accountId: 'account', status: 'scheduled' })
  })

  it('returns the shape of the post, for the publish-delay telemetry', async () => {
    provider()
    const image = await send(['a'])
    expect(image.media).toEqual({
      kind: 'image',
      images: 1,
      videos: 0,
      totalBytes: 1,
      largestVideoBytes: undefined,
      largestVideoSeconds: undefined
    })
    addVideo('v', { duration: 42, size: 5_000 })
    const carousel = await send(['a', 'v'])
    expect(carousel.media).toMatchObject({
      kind: 'carousel',
      images: 1,
      videos: 1,
      totalBytes: 5_001,
      largestVideoBytes: 5_000,
      largestVideoSeconds: 42
    })
    expect((await send(['v'])).media).toMatchObject({ kind: 'reel', videos: 1, images: 0 })
  })

  it('says which image is on its way', async () => {
    provider()
    const positions: number[] = []
    await sendPost({
      cell: 'cell',
      images: ['a', 'b'],
      post,
      onImage: (position) => positions.push(position)
    })
    expect(positions).toEqual([1, 2])
  })
})

describe('sending a post, continued', () => {
  it('uses the same key after a lost answer, and sends no image again', async () => {
    const { posts, stored } = provider({ loseAnswers: 1 })
    await expect(send(['a'])).rejects.toBeInstanceOf(ProviderRequestError)
    await send(['a'])
    const [first, second] = posts().map(({ headers }) => headers.get('idempotency-key'))
    expect(first).toBeTruthy()
    expect(second).toBe(first)
    expect(stored()).toHaveLength(1)
  })

  it('takes a new key for the next post, once one has gone through', async () => {
    const { posts } = provider()
    await send(['a'])
    await send(['a'])
    const [first, second] = posts().map(({ headers }) => headers.get('idempotency-key'))
    expect(second).not.toBe(first)
  })

  it('picks up from the image that failed', async () => {
    const { posts, stored } = provider({ failUploads: new Set([2]) })
    await expect(send(['a', 'b', 'c'])).rejects.toBeInstanceOf(ProviderRequestError)
    await send(['a', 'b', 'c'])
    expect(stored().map(({ url }) => url.split('/').pop())).toEqual([
      'a.jpeg',
      'b.jpeg',
      'b.jpeg',
      'c.jpeg'
    ])
    expect(posts()[0].body.mediaUrls).toEqual(['m:a.jpeg', 'm:b.jpeg', 'm:c.jpeg'])
  })

  it('sends an album again if it changed, under the same key', async () => {
    const { posts, stored } = provider({ loseAnswers: 1 })
    await expect(send(['a', 'b'])).rejects.toBeInstanceOf(ProviderRequestError)
    await send(['b', 'a'])
    const [first, second] = posts()
    expect(second.headers.get('idempotency-key')).toBe(first.headers.get('idempotency-key'))
    expect(second.body.mediaUrls).toEqual(['m:b.jpeg', 'm:a.jpeg'])
    expect(stored()).toHaveLength(4)
  })
})

describe('sending a post, with video and what is gone', () => {
  it('takes a new key once the provider will have forgotten the old one', async () => {
    const { posts } = provider({ loseAnswers: 1 })
    await expect(send(['a'])).rejects.toBeInstanceOf(ProviderRequestError)
    vi.useFakeTimers({ now: Date.now() + 25 * 3_600_000, toFake: ['Date'] })
    await send(['a'])
    vi.useRealTimers()
    const [first, second] = posts().map(({ headers }) => headers.get('idempotency-key'))
    expect(second).not.toBe(first)
  })

  it('stops at an image no longer on this device', async () => {
    const { posts } = provider()
    copies.delete('a')
    await expect(send(['a'])).rejects.toBeInstanceOf(MissingCopyError)
    expect(posts()).toEqual([])
  })

  it('sends a video as one, as a .mov, and says so beside the photos', async () => {
    addVideo('v')
    const { posts, stored } = provider()
    await send(['a', 'v'])
    expect(stored().map(({ url }) => url.split('/').pop())).toEqual(['a.jpeg', 'v.mov'])
    expect(posts()[0].body).toMatchObject({
      mediaUrls: ['m:a.jpeg', 'm:v.mov'],
      mediaTypes: ['image', 'video']
    })
  })

  it('sends photos alone as before, with no media types', async () => {
    const { posts } = provider()
    await send(['a'])
    expect(posts()[0].body).not.toHaveProperty('mediaTypes')
  })

  it.each([
    ['count', () => (addVideo('v'), addVideo('w'), ['v', 'w'])],
    ['size', () => (addVideo('v', { size: 301 * 1024 * 1024 }), ['v'])],
    ['length', () => (addVideo('v', { duration: 16 * 60 }), ['v'])]
  ])('refuses a video over the %s limit before anything is uploaded', async (limit, images) => {
    const { sent } = provider()
    const sending = send(images())
    await expect(sending).rejects.toBeInstanceOf(VideoLimitError)
    await expect(sending).rejects.toMatchObject({ limit })
    expect(sent).toEqual([])
  })

  it('sends the tags with the post', async () => {
    const { posts } = provider()
    const userTags = [{ username: 'friend', x: 0.5, y: 0.25 }]
    await sendPost({
      cell: 'tagged',
      images: ['a'],
      post: { ...post, userTags },
      onImage: () => undefined
    })
    expect(posts()[0].body).toMatchObject({ userTags })
  })
})
