import { dateTimeFormat } from '@/i18n/format'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export const formatPostTime = (time: string) =>
  dateTimeFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time))

/** As a `datetime-local` field wants it: the wall clock here, with no zone. */
export function toFieldTime(time: Date | string) {
  const date = new Date(time)
  const wallClock = date.getTime() - date.getTimezoneOffset() * MINUTE_MS
  return new Date(wallClock).toISOString().slice(0, 'YYYY-MM-DDTHH:mm'.length)
}

export const fromFieldTime = (time: string) => new Date(time).toISOString()

/** The first whole hour at least an hour away, which is somewhere to start from. */
export const nextFreeHour = (now = Date.now()) =>
  new Date(Math.ceil((now + HOUR_MS) / HOUR_MS) * HOUR_MS)
