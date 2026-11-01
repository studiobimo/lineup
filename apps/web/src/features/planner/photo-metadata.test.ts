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
})
