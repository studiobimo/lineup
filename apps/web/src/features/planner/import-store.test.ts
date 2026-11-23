import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { toastManager } from '@/components/ui/toast'

import { importImages } from './import-images'
import { fromFiles } from './import-source'
import { runImport } from './import-store'
import { plannerStore } from './planner'
import type { ProcessedImage } from './process-image'
import { loadStrings } from '@/i18n/load-strings'

vi.mock('./import-images', () => ({ importImages: vi.fn() }))

const photo = () => new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })
const processed = { width: 1, height: 1 } as unknown as ProcessedImage

beforeAll(() => loadStrings('planner'))

const importing = { add: vi.fn(), finish: vi.fn() }

describe('runImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    importing.add.mockReset().mockResolvedValue(undefined)
    importing.finish.mockReset()
    vi.spyOn(toastManager, 'add').mockReturnValue('toast')
    vi.mocked(importImages).mockImplementation(async (_files, { onBatch }) => {
      await onBatch([processed])
      return { failed: 0 }
    })
    vi.spyOn(plannerStore.getState(), 'opened').mockResolvedValue(true)
    vi.spyOn(plannerStore.getState(), 'beginImport').mockReturnValue(importing)
  })

  it('explains a full device', async () => {
    importing.finish.mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
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
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Those images could not be added. Please try again.'
      })
    )
  })

  it('takes another import after one fails', async () => {
    vi.mocked(importImages).mockRejectedValueOnce(new Error('the worker died'))
    await runImport(fromFiles([photo()]))
    await runImport(fromFiles([photo()]))
    expect(importing.finish).toHaveBeenCalledTimes(2)
  })

  it('stores what it has, once, when the import stops part-way', async () => {
    vi.mocked(importImages).mockRejectedValueOnce(new Error('the worker died'))
    await runImport(fromFiles([photo()]))
    expect(importing.finish).toHaveBeenCalledOnce()
  })

  it('reports a full device met part-way, as the first error', async () => {
    vi.mocked(importImages).mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    importing.finish.mockImplementation(() => {
      throw new Error('a later error')
    })
    await runImport(fromFiles([photo()]))
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'This device is out of room for images' })
    )
  })

  it('adds the images once, after every batch is stored', async () => {
    await runImport(fromFiles([photo()]))
    expect(importing.add).toHaveBeenCalledWith([processed])
    expect(importing.finish).toHaveBeenCalledOnce()
  })
})
