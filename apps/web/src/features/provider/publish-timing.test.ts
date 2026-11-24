import { SOONEST_MS } from 'lineup-contract'
import { describe, expect, it } from 'vitest'

import type { CellPost } from '@/features/planner/board-schema'
import type { Board, ImageRecord } from '@/features/planner/board-store'

import { defaultTime, gapWindows, publishGap, spacingFor } from './publish-timing'

const MINUTE = 60_000
const MB = 1024 * 1024
const T0 = Date.parse('2030-01-01T10:00:00.000Z')
const at = (minutes: number) => T0 + minutes * MINUTE

const post = (minutes: number, status: CellPost['status'] = 'scheduled'): CellPost => ({
  id: `post-${minutes}`,
  accountId: 'account',
  scheduledFor: new Date(at(minutes)).toISOString(),
  timeZone: 'Europe/London',
  caption: '',
  status
})
const record = (id: string, video = false): ImageRecord => ({
  id,
  width: 3,
  height: 4,
  createdAt: '',
  ...(video && { video: { type: 'video/mp4' as const, duration: 10 } })
})
const images = { a: record('a'), b: record('b', true), c: record('c'), d: record('d') }

const board = (posts: Board['posts']): Board => ({ tray: [], grid: ['a', 'b', 'c', 'd'], posts })
const check = (
  posts: Board['posts'],
  cell: string,
  when: number,
  sizes: Record<string, number> = {}
) => spacingFor({ board: board(posts), images, sizes, cell, when: at(when), soonest: at(-100) })

describe('the gap a post needs', () => {
  it('is 5 minutes for a picture', () => {
    expect(publishGap(false)).toBe(5 * MINUTE)
    expect(publishGap(false, 900 * MB)).toBe(5 * MINUTE)
  })

  it('is 15 minutes for a video, and a minute more for each 50 MB over 100 MB', () => {
    expect(publishGap(true)).toBe(15 * MINUTE)
    expect(publishGap(true, 100 * MB)).toBe(15 * MINUTE)
    expect(publishGap(true, 101 * MB)).toBe(16 * MINUTE)
    expect(publishGap(true, 150 * MB)).toBe(16 * MINUTE)
    expect(publishGap(true, 250 * MB)).toBe(18 * MINUTE)
  })
})

describe('spacing from the neighbours', () => {
  it('says nothing when there is room, or no neighbour', () => {
    expect(check({}, 'a', 0)).toBeUndefined()
    expect(check({ c: post(0) }, 'a', 5)).toBeUndefined()
    expect(check({ c: post(10) }, 'a', 5)).toBeUndefined()
  })

  it('warns when the post before is too near, and suggests the time it needs', () => {
    const spacing = check({ c: post(0) }, 'a', 3)
    expect(spacing?.near).toMatchObject([{ side: 'before', position: 3 }])
    expect(spacing?.suggested).toEqual(new Date(at(5)))
  })

  it('asks a video before it for more, by size', () => {
    const small = check({ b: post(0) }, 'a', 10)
    expect(small?.suggested).toEqual(new Date(at(15)))
    const big = check({ b: post(0) }, 'a', 10, { b: 250 * MB })
    expect(big?.suggested).toEqual(new Date(at(18)))
  })

  it('uses the base gap when a video’s size is not known', () => {
    expect(check({ b: post(0) }, 'a', 14)?.suggested).toEqual(new Date(at(15)))
  })

  it('warns when this post is too near the one after, and suggests earlier', () => {
    const spacing = check({ c: post(30) }, 'a', 28)
    expect(spacing?.near).toMatchObject([{ side: 'after', position: 3 }])
    expect(spacing?.suggested).toEqual(new Date(at(25)))
  })

  it('asks this post’s own gap before the next, so a video here needs 15 minutes', () => {
    const spacing = spacingFor({
      board: board({ c: post(30) }),
      images,
      sizes: {},
      cell: 'b',
      when: at(20),
      soonest: at(-100)
    })
    expect(spacing?.suggested).toEqual(new Date(at(15)))
  })

  it('offers no time that would run into the post after', () => {
    const spacing = check({ c: post(0), d: post(7) }, 'a', 3)
    expect(spacing?.near).toHaveLength(2)
    expect(spacing?.suggested).toBeUndefined()
  })

  it('never suggests before the soonest time', () => {
    const spacing = spacingFor({
      board: board({ c: post(0) }),
      images,
      sizes: {},
      cell: 'a',
      when: at(3),
      soonest: at(20)
    })
    expect(spacing?.suggested).toEqual(new Date(at(20)))
  })

  it('ignores posts that are not waiting to go out', () => {
    expect(check({ c: post(0, 'failed'), d: post(1, 'published') }, 'a', 2)).toBeUndefined()
  })

  it('ignores the post being changed', () => {
    expect(check({ a: post(0) }, 'a', 1)).toBeUndefined()
  })
})

const defaultAt = (posts: Board['posts'], cell: string, from = 0) =>
  (defaultTime({
    board: board(posts),
    images,
    sizes: {},
    cell,
    from: at(from),
    soonest: at(-100)
  }).getTime() -
    T0) /
  MINUTE

describe('the time a new post starts at', () => {
  it('is where it was asked to start when nothing is near', () => {
    expect(defaultAt({}, 'a', 60)).toBe(60)
    expect(defaultAt({ c: post(0) }, 'a', 60)).toBe(60)
  })

  it('never starts before the soonest time, even when asked to', () => {
    const soonest = T0 + SOONEST_MS
    const time = defaultTime({
      board: board({}),
      images,
      sizes: {},
      cell: 'a',
      from: T0,
      soonest
    }).getTime()
    expect(time).toBe(soonest)
  })

  it('leaves the post older on the grid its gap, when that is later', () => {
    expect(defaultAt({ c: post(58) }, 'a', 60)).toBe(63)
    expect(defaultAt({ c: post(58), b: post(55) }, 'a', 60)).toBe(70)
  })

  it('goes before the newer post when there is room, so the order holds', () => {
    expect(defaultAt({ a: post(30) }, 'c', 60)).toBe(25)
  })

  it('falls back to the older post when there is no room before the newer', () => {
    expect(defaultAt({ a: post(30), d: post(28) }, 'c', 0)).toBe(33)
  })
})

describe('the windows to mark in the picker', () => {
  it('cover the gap before and the gap after each post', () => {
    const windows = gapWindows({ board: board({ c: post(60) }), images, sizes: {}, cell: 'a' })
    expect(windows).toEqual([
      { start: at(56), end: at(60), side: 'after', position: 3, gap: 5 * MINUTE },
      { start: at(60), end: at(65), side: 'before', position: 3, gap: 5 * MINUTE }
    ])
  })

  it('use the gap of a video on either side', () => {
    const [before, after] = gapWindows({
      board: board({ b: post(60) }),
      images,
      sizes: {},
      cell: 'a'
    })
    expect(before).toMatchObject({ start: at(56), end: at(60) })
    expect(after).toMatchObject({ start: at(60), end: at(75), gap: 15 * MINUTE })
  })
})
