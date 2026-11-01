// The build this app imports has no names for tags, only their numbers.
const DATE_TIME_ORIGINAL = 0x9003

/** Exif writes dates as `2024:05:06 12:00:00`, in the camera's local time. */
function parseExifDate(written: unknown) {
  const parts = typeof written === 'string' ? written.match(/\d+/g)?.map(Number) : undefined
  if (parts?.length !== 6) return undefined
  const [year, month, day, hours, minutes, seconds] = parts
  const taken = new Date(year, month - 1, day, hours, minutes, seconds)
  return Number.isNaN(taken.getTime()) ? undefined : taken.toISOString()
}

/** When a photo was taken, as its own metadata says. A photo may well not say, and that is fine. */
export async function captureDate(file: Blob) {
  // Only those who turn the setting on load this.
  const { parse } = await import('exifr/dist/mini.esm.mjs')
  const tags = (await parse(file).catch(() => undefined)) as Record<number, unknown> | undefined
  return parseExifDate(tags?.[DATE_TIME_ORIGINAL])
}
