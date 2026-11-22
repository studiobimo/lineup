import { describe, expect, it } from 'vitest'

import { publishDelaySchema } from './telemetry'

const event = (extra: object = {}) => ({
  eventId: '2f1c4b6e-8f0e-4b1c-9d57-0c5d6a1b2c3d',
  scheduledFor: '2030-01-01T10:00:00Z',
  publishedAt: '2030-01-01T10:03:20Z',
  delaySeconds: 200,
  kind: 'carousel',
  images: 2,
  videos: 1,
  totalBytes: 9_000_000,
  largestVideoBytes: 7_000_000,
  largestVideoSeconds: 12.5,
  appVersion: 'v0.5.0',
  account: 'studio.bimo',
  ...extra
})

const valid = (extra?: object) => publishDelaySchema.safeParse(event(extra)).success

describe('publishDelaySchema', () => {
  it('takes an event with a video, and one without', () => {
    expect(valid()).toBe(true)
    expect(
      valid({
        kind: 'image',
        images: 1,
        videos: 0,
        largestVideoBytes: undefined,
        largestVideoSeconds: undefined
      })
    ).toBe(true)
  })

  it('refuses any field it does not list, so nothing private can ride along', () => {
    for (const extra of [{ caption: 'hi' }, { postId: 'abc' }, { url: 'https://x.test' }]) {
      expect(valid(extra)).toBe(false)
    }
  })

  it('needs a random uuid and not an id of something', () => {
    expect(valid({ eventId: 'post_123' })).toBe(false)
    expect(valid({ eventId: undefined })).toBe(false)
  })

  it('refuses a kind it does not know, a negative or fractional size and a negative delay', () => {
    expect(valid({ kind: 'story' })).toBe(false)
    expect(valid({ totalBytes: -1 })).toBe(false)
    expect(valid({ images: 1.5 })).toBe(false)
    expect(valid({ delaySeconds: -1 })).toBe(false)
  })

  it('takes an event with no account, and refuses a handle that is not trimmed and lowercased', () => {
    expect(valid({ account: undefined })).toBe(true)
    for (const account of [' studio', 'Studio', '@studio', '', 'a'.repeat(31), 'a b']) {
      expect(valid({ account })).toBe(false)
    }
  })

  it('refuses times that are not times and a count past a carousel', () => {
    expect(valid({ scheduledFor: 'tomorrow' })).toBe(false)
    expect(valid({ images: 21 })).toBe(false)
  })
})
