import type { ImportSettings } from './import-settings'
import { looksLikeHeif } from './looks-like-heif'
import { nearestCity } from './nearest-city'

export interface PhotoMetadata {
  takenAt?: string
  place?: string
}

const DATE_TIME_ORIGINAL = 0x9003

function parseExifDate(written: unknown) {
  const parts = typeof written === 'string' ? written.match(/\d+/g)?.map(Number) : undefined
  if (parts?.length !== 6) return undefined
  const [year, month, day, hours, minutes, seconds] = parts
  const taken = new Date(year, month - 1, day, hours, minutes, seconds)
  return Number.isNaN(taken.getTime()) ? undefined : taken.toISOString()
}

async function placeOf(position?: { latitude: number; longitude: number }) {
  if (!position) return undefined
  const { default: cities } = await import('./cities.json')
  return nearestCity(position.latitude, position.longitude, cities as never)
}

export async function readMetadata(
  file: Blob,
  { readCaptureDates, readLocations }: ImportSettings
): Promise<PhotoMetadata> {
  if (!readCaptureDates && !readLocations) return {}
  const heif = await looksLikeHeif(file)
  const { gps, parse } = heif
    ? await import('exifr/dist/lite.esm.mjs')
    : await import('exifr/dist/mini.esm.mjs')
  const tags = readCaptureDates
    ? ((await parse(file, heif ? { translateKeys: false, reviveValues: false } : undefined).catch(
        () => undefined
      )) as Record<number, unknown> | undefined)
    : undefined
  return {
    takenAt: parseExifDate(tags?.[DATE_TIME_ORIGINAL]),
    place: readLocations ? await placeOf(await gps(file).catch(() => undefined)) : undefined
  }
}
