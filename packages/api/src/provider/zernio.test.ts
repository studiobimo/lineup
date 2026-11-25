import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProviderError } from './provider'
import { baseUrlFor, zernio } from './zernio'

const KEY = 'sk_test_key'
const respond = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
const external = (platformPostId: string, fields: Record<string, unknown> = {}, target = {}) => ({
  _id: `zernio-${platformPostId}`,
  origin: 'external',
  status: 'published',
  platforms: [{ platform: 'instagram', platformPostId, ...target }],
  ...fields
})

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

describe('zernio', () => {
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
})

describe('zernio, accounts', () => {
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
})

describe('zernio, merged posts', () => {
  it('merges posts from elsewhere and from here, newest first, without the same one twice', async () => {
    stub.mockImplementation(async (url) =>
      String(url).includes('source=external')
        ? respond({
            posts: [
              external(
                'old',
                {},
                {
                  platformPostUrl: 'https://instagram.com/p/old',
                  publishedAt: '2026-01-01T00:00:00Z'
                }
              ),
              external(
                'twice',
                {},
                {
                  platformPostUrl: 'https://instagram.com/p/twice',
                  publishedAt: '2026-03-01T00:00:00Z'
                }
              ),
              external('story', { mediaProductType: 'STORY' })
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
})

describe('zernio, posts from here and elsewhere', () => {
  it('keeps posts whose optional fields Zernio sent as null', async () => {
    stub.mockImplementation(async (url) =>
      String(url).includes('source=external')
        ? respond({
            posts: [
              external(
                'nulls',
                { content: null, mediaItems: [{ url: null }], mediaProductType: null },
                { platformPostUrl: null, publishedAt: '2026-02-01T00:00:00Z' }
              )
            ]
          })
        : respond({
            posts: [
              {
                _id: 'drafted',
                status: 'published',
                content: null,
                scheduledFor: null,
                mediaItems: [{ url: null }],
                platforms: [{ platformPostUrl: null, publishedAt: null }]
              },
              { _id: 'bare', status: 'published', mediaItems: null, platforms: null }
            ]
          })
    )
    const posts = await provider.publishedPosts('account')
    expect(posts.map(({ id }) => id)).toEqual(['nulls', 'drafted', 'bare'])
  })

  it('spots a post from here synced back from elsewhere by its id, before it has a link', async () => {
    stub.mockImplementation(async (url) =>
      String(url).includes('source=external')
        ? respond({ posts: [external('ig-1', {}, { platformPostUrl: null })] })
        : respond({
            posts: [
              {
                _id: 'here',
                status: 'published',
                platforms: [{ platformPostId: 'ig-1', platformPostUrl: null }]
              }
            ]
          })
    )
    const posts = await provider.publishedPosts('account')
    expect(posts.map(({ id }) => id)).toEqual(['ig-1'])
  })
})

describe('zernio, a post from elsewhere', () => {
  it('shows a post from elsewhere with its picture, caption, link and date', async () => {
    stub.mockImplementation(async (url) =>
      respond({
        posts: String(url).includes('source=external')
          ? [
              external(
                'reel',
                {
                  content: 'A reel',
                  mediaProductType: 'REELS',
                  scheduledFor: '2026-04-01T00:00:00Z',
                  mediaItems: [
                    {
                      type: 'video',
                      url: 'https://cdn.test/reel.mp4',
                      thumbnail: 'https://cdn.test/reel.jpg'
                    }
                  ]
                },
                { platformPostUrl: 'https://instagram.com/reel/reel' }
              )
            ]
          : []
      })
    )
    expect(await provider.publishedPosts('account')).toEqual([
      {
        id: 'reel',
        url: 'https://instagram.com/reel/reel',
        thumbnailUrl: 'https://cdn.test/reel.jpg',
        videoUrl: 'https://cdn.test/reel.mp4',
        caption: 'A reel',
        publishedAt: '2026-04-01T00:00:00Z'
      }
    ])
  })

  it.each([
    ['says it is a video', { type: 'video', url: 'https://cdn.test/clip' }],
    ['ends in .mp4', { url: 'https://cdn.test/clip.mp4?signed=1' }]
  ])(
    'gives a video with no thumbnail no picture but its file, when its media %s',
    async (_, media) => {
      stub.mockImplementation(async (url) =>
        respond({
          posts: String(url).includes('source=external')
            ? [external('clip', { mediaProductType: 'REELS', mediaItems: [media] })]
            : []
        })
      )
      const [post] = await provider.publishedPosts('account')
      expect(post.thumbnailUrl).toBeUndefined()
      expect(post.videoUrl).toBe(media.url)
    }
  )
})

describe('zernio, scheduling', () => {
  it('lists an account whose optional fields Zernio sent as null', async () => {
    stub.mockResolvedValue(
      respond({
        accounts: [
          {
            _id: 'a',
            platform: 'instagram',
            username: null,
            displayName: null,
            isActive: true,
            needsReconnection: null
          }
        ]
      })
    )
    expect(await provider.accounts('profile')).toEqual([
      { id: 'a', username: 'a', needsReconnection: false }
    ])
  })

  it('logs the type and the field names of an answer it cannot read, and no value', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    stub.mockResolvedValue(respond({ posts: [{ _id: 'secret-id', content: 'secret caption' }] }))
    await expect(provider.publishedPosts('account')).rejects.toMatchObject({ failure: 'down' })
    const line = logged.mock.calls.map(([text]) => String(text)).join('\n')
    expect(line).toContain('posts.0.status:invalid_type:undefined')
    expect(line).toContain('"fields":["_id","content"]')
    expect(line).not.toContain('secret')
    logged.mockRestore()
  })
})

describe('zernio, scheduling a post', () => {
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
    expect(JSON.stringify(body)).not.toContain('platformSpecificData')
  })

  it('puts the tags in the Instagram options of the platform', async () => {
    stub.mockResolvedValue(respond({ post: { _id: 'post', status: 'scheduled' } }, 201))
    const userTags = [{ username: 'friend', x: 0.25, y: 0.5, mediaIndex: 1 }]
    await provider.schedule(
      {
        accountId: 'account',
        caption: '',
        scheduledFor: '2030-01-01T10:00:00Z',
        timeZone: 'Europe/Madrid',
        mediaUrls: ['https://media.zernio.com/1.jpg', 'https://media.zernio.com/2.jpg'],
        userTags
      },
      'once'
    )
    expect(sent().body).toMatchObject({
      platforms: [
        { platform: 'instagram', accountId: 'account', platformSpecificData: { userTags } }
      ]
    })
  })
})

describe('zernio, alt text', () => {
  const created = () =>
    stub.mockResolvedValue(respond({ post: { _id: 'post', status: 'scheduled' } }, 201))
  const when = {
    accountId: 'account',
    caption: '',
    scheduledFor: '2030-01-01T10:00:00Z',
    timeZone: 'Europe/Madrid'
  }

  it('sends the description of each image, and leaves out an empty one', async () => {
    created()
    await provider.schedule(
      {
        ...when,
        mediaUrls: ['https://m.test/1.jpg', 'https://m.test/2.jpg'],
        altTexts: [' A cat ', '']
      },
      'once'
    )
    const { mediaItems } = sent().body as { mediaItems: object[] }
    expect(mediaItems[0]).toEqual({ type: 'image', url: 'https://m.test/1.jpg', altText: 'A cat' })
    expect(mediaItems[1]).not.toHaveProperty('altText')
  })

  it('leaves it out for a video', async () => {
    created()
    await provider.schedule(
      {
        ...when,
        mediaUrls: ['https://m.test/1.mp4'],
        mediaTypes: ['video'],
        altTexts: ['A clip']
      },
      'once'
    )
    expect(JSON.stringify(sent().body)).not.toContain('altText')
  })
})

describe('zernio, changing a post', () => {
  const stored = {
    post: {
      _id: 'post',
      status: 'scheduled',
      mediaItems: [
        { type: 'image', url: 'https://m.test/1.jpg', altText: 'A cat', thumbnail: null }
      ],
      platforms: [
        {
          platform: 'instagram',
          accountId: { _id: 'account', username: 'studio' },
          status: 'pending',
          platformSpecificData: {
            userTags: [{ username: 'friend', x: 0.5, y: 0.5 }],
            droppedCollaborators: [{ username: 'x', reason: 'no' }]
          }
        }
      ]
    }
  }

  it('reads the post and sends its media and options back whole', async () => {
    stub.mockResolvedValueOnce(respond(stored)).mockResolvedValueOnce(respond(stored))
    await provider.update('post', {
      scheduledFor: '2030-01-01T10:00:00Z',
      timeZone: 'Europe/Madrid',
      caption: 'New'
    })
    expect(sent(0).method).toBeUndefined()
    const { method, url, body } = sent(1)
    expect(method).toBe('PUT')
    expect(url).toBe('https://zernio.com/api/v1/posts/post')
    expect(body).toEqual({
      scheduledFor: '2030-01-01T10:00:00Z',
      timezone: 'Europe/Madrid',
      content: 'New',
      mediaItems: [{ type: 'image', url: 'https://m.test/1.jpg', altText: 'A cat' }],
      platforms: [
        {
          platform: 'instagram',
          accountId: 'account',
          platformSpecificData: { userTags: [{ username: 'friend', x: 0.5, y: 0.5 }] }
        }
      ]
    })
  })

  it('changes nothing when the post cannot be read', async () => {
    stub.mockResolvedValueOnce(respond({ error: 'gone' }, 404))
    await expect(
      provider.update('post', { scheduledFor: '2030-01-01T10:00:00Z', timeZone: 'Europe/Madrid' })
    ).rejects.toMatchObject({ failure: 'missing' })
    expect(stub).toHaveBeenCalledTimes(1)
  })
})

const scheduleOne = async (extra: Partial<Parameters<typeof provider.schedule>[0]> = {}) => {
  stub.mockResolvedValue(respond({ post: { _id: 'post', status: 'scheduled' } }, 201))
  await provider.schedule(
    {
      accountId: 'account',
      caption: '',
      scheduledFor: '2030-01-01T10:00:00Z',
      timeZone: 'Europe/Madrid',
      mediaUrls: ['https://m.test/1.jpg'],
      ...extra
    },
    'once'
  )
}

describe('zernio, collaborators', () => {
  it('sends them beside the tags in the Instagram options', async () => {
    await scheduleOne({
      userTags: [{ username: 'friend', x: 0.1, y: 0.2 }],
      collaborators: ['one', 'two']
    })
    expect(sent().body).toMatchObject({
      platforms: [
        {
          platformSpecificData: {
            userTags: [{ username: 'friend', x: 0.1, y: 0.2 }],
            collaborators: ['one', 'two']
          }
        }
      ]
    })
  })

  it('sends no options when there are none', async () => {
    await scheduleOne({
      collaborators: []
    })
    expect(JSON.stringify(sent().body)).not.toContain('platformSpecificData')
  })

  it('reports the ones Instagram dropped', async () => {
    stub.mockResolvedValue(
      respond({
        posts: [
          {
            _id: 'post',
            status: 'scheduled',
            platforms: [
              {
                platformSpecificData: {
                  collaborators: ['one', 'two'],
                  droppedCollaborators: [{ username: 'two', reason: 'Account is private' }]
                }
              }
            ]
          }
        ]
      })
    )
    const [post] = await provider.scheduledPosts('account')
    expect(post).toMatchObject({
      collaborators: ['one', 'two'],
      droppedCollaborators: [{ username: 'two', reason: 'Account is private' }]
    })
  })
})

describe('zernio, comment options', () => {
  it('sends comments off and a trimmed first comment in the Instagram options', async () => {
    await scheduleOne({ commentsEnabled: false, firstComment: ' Link in bio ' })
    expect(sent().body).toMatchObject({
      platforms: [{ platformSpecificData: { commentsEnabled: false, firstComment: 'Link in bio' } }]
    })
  })

  it('sends nothing for comments left on and a blank first comment', async () => {
    await scheduleOne({ commentsEnabled: true, firstComment: '  ' })
    expect(JSON.stringify(sent().body)).not.toContain('platformSpecificData')
  })

  it('reports both on a post that is read back', async () => {
    stub.mockResolvedValue(
      respond({
        posts: [
          {
            _id: 'post',
            status: 'scheduled',
            platforms: [
              { platformSpecificData: { commentsEnabled: false, firstComment: 'Link in bio' } }
            ]
          }
        ]
      })
    )
    const [post] = await provider.scheduledPosts('account')
    expect(post).toMatchObject({ commentsEnabled: false, firstComment: 'Link in bio' })
  })
})

describe('zernio, video and cancelling', () => {
  it('sends a video as one, beside the images of its carousel', async () => {
    await scheduleOne({
      mediaUrls: ['https://media.zernio.com/1.jpg', 'https://media.zernio.com/2.mp4'],
      mediaTypes: ['image', 'video']
    })
    expect(sent().body).toMatchObject({
      mediaItems: [
        { type: 'image', url: 'https://media.zernio.com/1.jpg' },
        { type: 'video', url: 'https://media.zernio.com/2.mp4' }
      ]
    })
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

  it('passes on when the platform published a post, for the delay telemetry', async () => {
    stub.mockResolvedValue(
      respond({
        posts: [
          {
            _id: 'post',
            status: 'published',
            platforms: [{ publishedAt: '2030-01-01T10:03:20Z', platformPostUrl: null }]
          },
          { _id: 'soon', status: 'scheduled', platforms: [] }
        ]
      })
    )
    const posts = await provider.scheduledPosts('account')
    expect(posts[0]).toMatchObject({ publishedAt: '2030-01-01T10:03:20Z' })
    expect(posts[1].publishedAt).toBeUndefined()
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
})

describe('zernio, failures', () => {
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

describe('the base URL override', () => {
  it('honours a local address, for the fake Zernio', async () => {
    stub.mockResolvedValue(respond({ profiles: [] }))
    await zernio(KEY, 'http://localhost:8788/').profiles()
    expect(sent().url).toBe('http://localhost:8788/profiles')
  })

  it.each([
    'https://zernio.com.evil.test/api/v1',
    'https://localhost:8788',
    'http://localhost.evil.test',
    'http://localhost@evil.test',
    'http://evil.test/localhost',
    'http://10.0.0.1:8788',
    'ftp://localhost',
    ''
  ])('ignores %j, so a key never goes elsewhere', (override) => {
    expect(baseUrlFor(override)).toBe('https://zernio.com/api/v1')
  })

  it.each(['http://localhost', 'http://127.0.0.1:8788', 'http://localhost:8788/api/v1'])(
    'accepts %s',
    (override) => expect(baseUrlFor(override)).toBe(override)
  )
})
