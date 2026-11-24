import { soonestSchedule } from 'lineup-contract'
import { describe, expect, it } from 'vitest'

import { fromFieldTime, nextFreeHour, toFieldTime } from './post-time'

describe('post times', () => {
  it('survive a trip through a field that has no zone', () => {
    const time = '2030-06-01T09:30:00.000Z'
    expect(fromFieldTime(toFieldTime(time))).toBe(time)
  })

  it('start at a whole hour at least an hour away', () => {
    const now = Date.parse('2030-06-01T09:10:00.000Z')
    expect(nextFreeHour(now).toISOString()).toBe('2030-06-01T11:00:00.000Z')
  })

  it('never offer a time before the soonest allowed', () => {
    const now = Date.parse('2030-06-01T09:59:59.000Z')
    expect(nextFreeHour(now).getTime()).toBeGreaterThanOrEqual(soonestSchedule(now).getTime())
  })
})
