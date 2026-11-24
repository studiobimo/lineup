import { describe, expect, it } from 'vitest'

import {
  cleanUsername,
  newPostSchema,
  POST,
  SOONEST_MINUTES,
  SOONEST_MS,
  soonestSchedule,
  TAGS_PER_POST
} from './provider'

const post = (extra: object = {}) => ({
  accountId: 'account',
  caption: '',
  scheduledFor: '2030-01-01T10:00:00Z',
  timeZone: 'Europe/Madrid',
  mediaUrls: ['https://media.test/1.jpg', 'https://media.test/2.mp4'],
  mediaTypes: ['image', 'video'],
  ...extra
})

const valid = (extra?: object) => newPostSchema.safeParse(post(extra)).success

describe('newPostSchema, user tags', () => {
  it('takes a post with no tags', () => {
    expect(valid()).toBe(true)
  })

  it('needs a point on an image and not on a video', () => {
    expect(valid({ userTags: [{ username: 'a', x: 0.2, y: 0.4 }] })).toBe(true)
    expect(valid({ userTags: [{ username: 'a' }] })).toBe(false)
    expect(valid({ userTags: [{ username: 'a', mediaIndex: 1 }] })).toBe(true)
  })

  it('refuses a slide that is not there, a point off the picture and a bad username', () => {
    expect(valid({ userTags: [{ username: 'a', x: 0, y: 0, mediaIndex: 2 }] })).toBe(false)
    expect(valid({ userTags: [{ username: 'a', x: 1.2, y: 0 }] })).toBe(false)
    expect(valid({ userTags: [{ username: '@a', x: 0, y: 0 }] })).toBe(false)
    expect(valid({ userTags: [{ username: 'a b', x: 0, y: 0 }] })).toBe(false)
    expect(valid({ userTags: [{ username: 'a'.repeat(31), x: 0, y: 0 }] })).toBe(false)
  })

  it('caps the tags on a post', () => {
    const tags = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ username: `a${index}`, x: 0, y: 0 }))
    expect(valid({ userTags: tags(TAGS_PER_POST) })).toBe(true)
    expect(valid({ userTags: tags(TAGS_PER_POST + 1) })).toBe(false)
  })
})

describe('newPostSchema, alt text', () => {
  it('takes a description for each slide, or none', () => {
    expect(valid({ altTexts: ['A cat', ''] })).toBe(true)
    expect(valid({ altTexts: ['A cat'] })).toBe(true)
  })

  it('refuses a description for a slide that does not exist, or one that is too long', () => {
    expect(valid({ altTexts: ['a', 'b', 'c'] })).toBe(false)
    expect(valid({ altTexts: ['a'.repeat(POST.limit.altText + 1)] })).toBe(false)
    expect(valid({ altTexts: ['a'.repeat(POST.limit.altText)] })).toBe(true)
  })
})

describe('newPostSchema, collaborators', () => {
  it('takes up to three usernames', () => {
    expect(valid({ collaborators: ['one', 'two', 'three.3'] })).toBe(true)
    expect(
      valid({
        collaborators: Array.from({ length: POST.limit.collaborators + 1 }, (_, i) => `a${i}`)
      })
    ).toBe(false)
  })

  it('refuses a name Instagram would not take, or one given twice', () => {
    expect(valid({ collaborators: ['@one'] })).toBe(false)
    expect(valid({ collaborators: ['One', 'one'] })).toBe(false)
  })
})

describe('newPostSchema, comment options', () => {
  it('takes comments turned off and a first comment', () => {
    expect(valid({ commentsEnabled: false, firstComment: 'Link in bio' })).toBe(true)
    expect(valid({ commentsEnabled: 'no' })).toBe(false)
  })

  it('caps the first comment', () => {
    expect(valid({ firstComment: 'a'.repeat(POST.limit.firstComment) })).toBe(true)
    expect(valid({ firstComment: 'a'.repeat(POST.limit.firstComment + 1) })).toBe(false)
  })
})

describe('cleanUsername', () => {
  it('drops the @ and the case', () => {
    expect(cleanUsername('  @Some.One ')).toBe('some.one')
  })
})

describe('soonestSchedule', () => {
  const now = Date.parse('2030-06-01T09:10:30.000Z')

  it('is 20 minutes away', () => {
    expect(SOONEST_MINUTES).toBe(20)
    expect(SOONEST_MS).toBe(20 * 60_000)
  })

  it('lands on the first whole minute at least 20 minutes away', () => {
    expect(soonestSchedule(now).toISOString()).toBe('2030-06-01T09:31:00.000Z')
    const onTheMinute = Date.parse('2030-06-01T09:10:00.000Z')
    expect(soonestSchedule(onTheMinute).toISOString()).toBe('2030-06-01T09:30:00.000Z')
  })

  it('is never nearer than the minimum', () => {
    expect(soonestSchedule(now).getTime() - now).toBeGreaterThanOrEqual(SOONEST_MS)
  })
})
