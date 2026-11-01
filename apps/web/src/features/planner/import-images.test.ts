import { describe, expect, it, vi } from 'vitest'

import { importImages } from './import-images'
import type { ProcessedImage } from './process-image'

const image = { width: 1, height: 1 } as ProcessedImage
const unreadable = new Blob(['unreadable'])

// Answers like the real worker: one reply per file, null for a file that will not decode.
function fakeWorker() {
  const worker = {
    onmessage: null as ((event: { data: ProcessedImage | null }) => void) | null,
    onerror: null,
    onmessageerror: null,
    postMessage: vi.fn((file: Blob) =>
      queueMicrotask(() => worker.onmessage?.({ data: file === unreadable ? null : image }))
    ),
    terminate: vi.fn()
  }
  return worker
}

const create = (worker: ReturnType<typeof fakeWorker>) => () => worker as unknown as Worker

describe('importImages', () => {
  it('skips a file that fails, counts it and imports the rest', async () => {
    const result = await importImages([new Blob(), unreadable, new Blob()], {
      createWorker: create(fakeWorker())
    })
    expect(result.images).toHaveLength(2)
    expect(result.failed).toBe(1)
  })

  it('reports progress after every file, failed or not', async () => {
    const onProgress = vi.fn()
    await importImages([unreadable, new Blob()], { onProgress, createWorker: create(fakeWorker()) })
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2]
    ])
  })

  it('sends one file at a time', async () => {
    const worker = fakeWorker()
    const sentBeforeFirstReply: number[] = []
    const { postMessage } = worker
    worker.postMessage = vi.fn((file: Blob) => {
      sentBeforeFirstReply.push(postMessage.mock.calls.length)
      postMessage(file)
    })
    await importImages([new Blob(), new Blob(), new Blob()], { createWorker: create(worker) })
    expect(sentBeforeFirstReply).toEqual([0, 1, 2])
  })

  it('counts a worker that errors as a failed file, and goes on', async () => {
    const worker = fakeWorker()
    worker.postMessage.mockImplementationOnce(() =>
      queueMicrotask(() =>
        (worker.onerror as unknown as (error: Error) => void)(new Error('crash'))
      )
    )
    const result = await importImages([new Blob(), new Blob()], { createWorker: create(worker) })
    expect(result).toMatchObject({ failed: 1, images: [image] })
  })

  it('stops the worker when the batch ends', async () => {
    const worker = fakeWorker()
    await importImages([new Blob()], { createWorker: create(worker) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
