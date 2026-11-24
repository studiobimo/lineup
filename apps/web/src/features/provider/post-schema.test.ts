import { SOONEST_MS } from 'lineup-contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { postFormSchema } from './post-schema'

const NOW = Date.parse('2030-06-01T09:00:00.000Z')

const accepts = (offset: number) =>
  postFormSchema.safeParse({ caption: '', when: new Date(NOW + offset).toISOString() }).success

describe('the post form time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuses a time under 20 minutes away', () => {
    expect(accepts(0)).toBe(false)
    expect(accepts(60_000)).toBe(false)
    expect(accepts(SOONEST_MS - 60_000)).toBe(false)
  })

  it('accepts a time 20 minutes away or more', () => {
    expect(accepts(SOONEST_MS)).toBe(true)
    expect(accepts(SOONEST_MS + 60_000)).toBe(true)
  })
})
