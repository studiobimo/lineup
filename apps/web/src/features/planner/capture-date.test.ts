import { describe, expect, it } from 'vitest'

import { captureDate } from './capture-date'

describe('captureDate', () => {
  it('finds nothing in a file with no metadata, and does not throw', async () => {
    await expect(captureDate(new Blob(['not a photo']))).resolves.toBeUndefined()
  })
})
