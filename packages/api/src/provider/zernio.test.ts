import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError } from './provider'
import { zernio } from './zernio'

const KEY = 'sk_test_key'
const respond = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers })

describe('zernio', () => {
  const stub = vi.fn<typeof fetch>()
  const provider = zernio(KEY)
  const sent = (call = 0) => {
    const [url, init] = stub.mock.calls[call]
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    return { url: String(url), method: init?.method, headers: init?.headers, body }
  }

  beforeEach(() => {
    stub.mockReset()
    vi.stubGlobal('fetch', stub)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('sends the key as a bearer token, to Zernio and nowhere else', async () => {
    stub.mockResolvedValue(respond({ profiles: [{ _id: 'one', name: 'Main' }] }))
    expect(await provider.profiles()).toEqual([{ id: 'one', name: 'Main' }])
    expect(sent().url).toBe('https://zernio.com/api/v1/profiles')
    expect(sent().headers).toMatchObject({ Authorization: `Bearer ${KEY}` })
  })

  it('narrows a key to one profile, 30 days, and only what Lineup calls', async () => {
    stub.mockResolvedValue(respond({ apiKey: { key: 'zrk_narrow' } }, 201))
    expect(await provider.narrowed('profile', 30)).toBe('zrk_narrow')
    const { body } = sent()
    expect(body).toMatchObject({ scope: 'profiles', profileIds: ['profile'], expiresIn: 30 })
    const disabled = body?.disabledResourceGroups as string[]
    expect(disabled).toContain('messages')
    expect(disabled).not.toContain('publishing')
    expect(disabled).not.toContain('accounts')
  })

  it.each([403, 400])('gives up narrowing on a %i, for a key that cannot', async (status) => {
    stub.mockResolvedValue(respond({ error: 'no' }, status))
    expect(await provider.narrowed('profile', 30)).toBeUndefined()
  })

  it('takes a refused write for a read-only key, and not for a bad one', async () => {
    stub.mockResolvedValue(respond({}, 401))
    expect(await provider.narrowed('profile', 30)).toBeUndefined()
  })

  it.each([401, 403])('says a key that gets %i asking to upload cannot post', async (status) => {
    stub.mockResolvedValue(respond({}, status))
    expect(await provider.canPost()).toBe(false)
  })

  it('says a key that gets an upload URL can post, and uploads nothing', async () => {
    stub.mockResolvedValue(respond({ uploadUrl: 'https://u.test', publicUrl: 'https://p.test' }))
    expect(await provider.canPost()).toBe(true)
    expect(sent().url).toContain('/media/presign')
    expect(stub).toHaveBeenCalledTimes(1)
  })

  it('does not call a key read-only because of an outage', async () => {
    stub.mockResolvedValue(respond({}, 503))
    await expect(provider.canPost()).rejects.toMatchObject({ failure: 'down' })
  })

  it('does not hide an outage behind a key that could not be narrowed', async () => {
    stub.mockResolvedValue(respond({}, 503))
    await expect(provider.narrowed('profile', 30)).rejects.toMatchObject({ failure: 'down' })
  })

  it('lists only Instagram accounts that are active', async () => {
    stub.mockResolvedValue(
      respond({
        accounts: [
          {
            _id: 'a',
            platform: 'instagram',
            username: 'me',
            isActive: true,
            profilePicture: null,
            followersCount: 12
          },
          { _id: 'b', platform: 'twitter', username: 'x', isActive: true },
          { _id: 'c', platform: 'instagram', username: 'old', isActive: false }
        ]
      })
    )
    expect(await provider.accounts('profile')).toEqual([
      { id: 'a', username: 'me', followers: 12, needsReconnection: false }
    ])
    expect(sent().url).toContain('profileId=profile')
  })

  it('merges posts from elsewhere and from here, newest first, without the same one twice', async () => {
    stub.mockImplementation(async (url) =>
      String(url).includes('source=external')
        ? respond({
            posts: [
              {
                platformPostId: 'old',
                platformPostUrl: 'https://instagram.com/p/old',
                publishedAt: '2026-01-01T00:00:00Z'
              },
              {
                platformPostId: 'twice',
                platformPostUrl: 'https://instagram.com/p/twice',
                publishedAt: '2026-03-01T00:00:00Z'
              },
              { platformPostId: 'story', mediaProductType: 'STORY' }
            ]
          })
        : respond({
            posts: [
              {
                _id: 'new',
                status: 'published',
                mediaItems: [{ url: 'https://media.zernio.com/new.jpg' }],
                platforms: [
                  {
                    platformPostUrl: 'https://instagram.com/p/new',
                    publishedAt: '2026-06-01T00:00:00Z'
                  }
                ]
              },
              {
                _id: 'same',
                status: 'published',
                platforms: [{ platformPostUrl: 'https://instagram.com/p/twice' }]
              }
            ]
          })
    )
    const posts = await provider.publishedPosts('account')
    expect(posts.map(({ id }) => id)).toEqual(['new', 'twice', 'old'])
    expect(posts[0].thumbnailUrl).toBe('https://media.zernio.com/new.jpg')
  })

  it('schedules one Instagram post with its images in order and the idempotency key', async () => {
    stub.mockResolvedValue(respond({ post: { _id: 'post', status: 'scheduled' } }, 201))
    const post = await provider.schedule(
      {
        accountId: 'account',
        caption: 'Hello',
        scheduledFor: '2030-01-01T10:00:00Z',
        timeZone: 'Europe/Madrid',
        mediaUrls: ['https://media.zernio.com/1.jpg', 'https://media.zernio.com/2.jpg']
      },
      'once'
    )
    expect(post).toMatchObject({ id: 'post', status: 'scheduled' })
    const { headers, body, method } = sent()
    expect(method).toBe('POST')
    expect(headers).toMatchObject({ 'Idempotency-Key': 'once' })
    expect(body).toMatchObject({
      content: 'Hello',
      timezone: 'Europe/Madrid',
      platforms: [{ platform: 'instagram', accountId: 'account' }],
      mediaItems: [
        { type: 'image', url: 'https://media.zernio.com/1.jpg' },
        { type: 'image', url: 'https://media.zernio.com/2.jpg' }
      ]
    })
    expect(body).not.toHaveProperty('publishNow')
  })

  it.each([
    ['draft', 'scheduled'],
    ['publishing', 'publishing'],
    ['published', 'published'],
    ['partial', 'failed'],
    ['failed', 'failed'],
    ['cancelled', 'cancelled']
  ])('reads %s as %s, with why it failed', async (status, expected) => {
    stub.mockResolvedValue(
      respond({
        posts: [{ _id: 'post', status, platforms: [{ errorMessage: 'Too wide', status: 'x' }] }]
      })
    )
    const [post] = await provider.scheduledPosts('account')
    expect(post).toMatchObject({ status: expected, failure: 'Too wide' })
  })

  it('treats cancelling a post that has already gone as done', async () => {
    stub.mockResolvedValue(respond({ error: 'gone' }, 404))
    await expect(provider.cancel('post')).resolves.toBeUndefined()
    expect(sent().method).toBe('DELETE')
  })

  it('accepts an empty answer to a cancel, and reports a refused one', async () => {
    stub.mockResolvedValueOnce(respond(undefined, 204))
    await expect(provider.cancel('post')).resolves.toBeUndefined()
    stub.mockResolvedValueOnce(respond({ error: 'Published posts cannot be deleted' }, 400))
    await expect(provider.cancel('post')).rejects.toMatchObject({
      failure: 'refused',
      details: { detail: 'Published posts cannot be deleted' }
    })
  })

  it.each([
    [401, 'key'],
    [403, 'forbidden'],
    [404, 'missing'],
    [409, 'busy'],
    [422, 'refused'],
    [429, 'limited'],
    [500, 'down'],
    [503, 'down']
  ])('reads a %i as %s', async (status, failure) => {
    stub.mockResolvedValue(respond({ error: 'no' }, status, { 'Retry-After': '7' }))
    const error = await provider.profiles().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ProviderError)
    expect(error).toMatchObject({ failure, details: { retryAfter: 7 } })
  })

  it('treats a network failure and an unexpected answer as being down', async () => {
    stub.mockRejectedValueOnce(new TypeError('offline'))
    await expect(provider.profiles()).rejects.toMatchObject({ failure: 'down' })
    stub.mockResolvedValueOnce(respond({ surprise: true }))
    await expect(provider.profiles()).rejects.toMatchObject({ failure: 'down' })
    stub.mockResolvedValueOnce(new Response('<html>', { status: 200 }))
    await expect(provider.profiles()).rejects.toMatchObject({ failure: 'down' })
  })
})
