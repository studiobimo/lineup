import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readMetadata } from './photo-metadata'

const everything = { readCaptureDates: true, readLocations: true }

describe('readMetadata', () => {
  it('finds nothing in a file with no metadata, and does not throw', async () => {
    await expect(readMetadata(new Blob(['not a photo']), everything)).resolves.toEqual({})
  })

  it('reads nothing when nothing is asked for', async () => {
    const off = { readCaptureDates: false, readLocations: false }
    await expect(readMetadata(new Blob(['not a photo']), off)).resolves.toEqual({})
  })

  it('reads the date and the city from a HEIC photo, which the small reader cannot open', async () => {
    // Taken at 12:30 on 6 May 2024, at 48°N 2°W, with the least Exif that says so.
    const heic = new Blob([
      readFileSync(resolve(import.meta.dirname, '../../../e2e/fixtures/photo.heic'))
    ])

    const found = await readMetadata(heic, everything)

    expect(found.takenAt).toBe(new Date(2024, 4, 6, 12, 30).toISOString())
    expect(found.place).toBeTruthy()
  })
})
