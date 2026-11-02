import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { toastManager } from '@/components/ui/toast'

import { importImages } from './import-images'
import { fromFiles } from './import-source'
import { runImport } from './import-store'
import { plannerStore } from './planner'
import type { ProcessedImage } from './process-image'
import { loadPlannerStrings } from './planner-strings'

vi.mock('./import-images', () => ({ importImages: vi.fn() }))

const photo = () => new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })
const processed = { width: 1, height: 1 } as unknown as ProcessedImage

// The route loads these before it renders the page.
beforeAll(loadPlannerStrings)

describe('runImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(toastManager, 'add').mockReturnValue('toast')
    vi.mocked(importImages).mockResolvedValue({ images: [processed], failed: 0 })
    vi.spyOn(plannerStore.getState(), 'addImages').mockResolvedValue()
  })

  it('explains a full device', async () => {
    vi.spyOn(plannerStore.getState(), 'addImages').mockRejectedValue(
      new DOMException('full', 'QuotaExceededError')
    )
    await runImport(fromFiles([photo()]))
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'This device is out of room for images',
        description: expect.stringContaining('free up space') as string
      })
    )
  })

  it('says so when anything else goes wrong', async () => {
    vi.mocked(importImages).mockRejectedValue(new Error('the worker died'))
    await runImport(fromFiles([photo()]))
    expect(toastManager.add).toHaveBeenCalledWith({
      type: 'error',
      title: 'Those images could not be added. Please try again.'
    })
  })

  it('takes another import after one fails', async () => {
    vi.mocked(importImages).mockRejectedValueOnce(new Error('the worker died'))
    await runImport(fromFiles([photo()]))
    await runImport(fromFiles([photo()]))
    expect(plannerStore.getState().addImages).toHaveBeenCalledOnce()
  })
})
