import type { ImportSettings } from './import-settings'
import { nearestCity } from './nearest-city'

export interface PhotoMetadata {
  takenAt?: string
  place?: string
}

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

/** Coordinates end here: a city comes out, and nothing nearer than that is ever stored. */
async function placeOf(position?: { latitude: number; longitude: number }) {
  if (!position) return undefined
  const { default: cities } = await import('./cities.json')
  return nearestCity(position.latitude, position.longitude, cities as never)
}

/** What a photo's own metadata says, among what the settings ask for. It may well say nothing. */
export async function readMetadata(
  file: Blob,
  { readCaptureDates, readLocations }: ImportSettings
): Promise<PhotoMetadata> {
  if (!readCaptureDates && !readLocations) return {}
  // Only those who turn a setting on load this.
  const { gps, parse } = await import('exifr/dist/mini.esm.mjs')
  const tags = readCaptureDates
    ? ((await parse(file).catch(() => undefined)) as Record<number, unknown> | undefined)
    : undefined
  return {
    takenAt: parseExifDate(tags?.[DATE_TIME_ORIGINAL]),
    place: readLocations ? await placeOf(await gps(file).catch(() => undefined)) : undefined
  }
}
