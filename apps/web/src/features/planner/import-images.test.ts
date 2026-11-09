import { describe, expect, it, vi } from 'vitest'

import { importImages, type ImageTask } from './import-images'
import type { ProcessedImage } from './process-image'

const image = { width: 1, height: 1 } as ProcessedImage
const unreadable = new Blob(['unreadable'])

function fakeWorker() {
  const worker = {
    onmessage: null as ((event: { data: ProcessedImage | null }) => void) | null,
    onerror: null,
    onmessageerror: null,
    postMessage: vi.fn(({ file }: ImageTask) =>
      queueMicrotask(() => worker.onmessage?.({ data: file === unreadable ? null : image }))
    ),
    terminate: vi.fn()
  }
  return worker
}

const create = (worker: ReturnType<typeof fakeWorker>) => () => worker as unknown as Worker

async function run(files: Blob[], options: Partial<Parameters<typeof importImages>[1]> = {}) {
  const batches: ProcessedImage[][] = []
  const result = await importImages(files, {
    onBatch: (batch) => {
      batches.push(batch)
      return Promise.resolve()
    },
    createWorker: create(fakeWorker()),
    ...options
  })
  return { ...result, batches, images: batches.flat() }
}

describe('importImages', () => {
  it('skips a file that fails, counts it and imports the rest', async () => {
    const result = await run([new Blob(), unreadable, new Blob()])
    expect(result.images).toHaveLength(2)
    expect(result.failed).toBe(1)
  })

  it('reports progress after every file, failed or not', async () => {
    const onProgress = vi.fn()
    await run([unreadable, new Blob()], { onProgress })
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2]
    ])
  })

  it('sends one file at a time', async () => {
    const worker = fakeWorker()
    const sentBeforeFirstReply: number[] = []
    const { postMessage } = worker
    worker.postMessage = vi.fn((task: ImageTask) => {
      sentBeforeFirstReply.push(postMessage.mock.calls.length)
      postMessage(task)
    })
    await run([new Blob(), new Blob(), new Blob()], { createWorker: create(worker) })
    expect(sentBeforeFirstReply).toEqual([0, 1, 2])
  })

  it('counts a worker that errors as a failed file, and goes on', async () => {
    const worker = fakeWorker()
    worker.postMessage.mockImplementationOnce(() =>
      queueMicrotask(() =>
        (worker.onerror as unknown as (error: Error) => void)(new Error('crash'))
      )
    )
    const result = await run([new Blob(), new Blob()], { createWorker: create(worker) })
    expect(result).toMatchObject({ failed: 1, images: [image] })
  })

  it('stops the worker when the batch ends', async () => {
    const worker = fakeWorker()
    await run([new Blob()], { createWorker: create(worker) })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('hands images over in small batches, so a large import is never all in memory', async () => {
    const { batches } = await run(Array.from({ length: 25 }, () => new Blob()))
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 5])
  })
})

describe('importImages, with the store and video', () => {
  it('waits for a batch to be stored before it reads on', async () => {
    const worker = fakeWorker()
    let release = () => {}
    const onBatch = vi
      .fn(() => Promise.resolve())
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
    const importing = importImages(
      Array.from({ length: 12 }, () => new Blob()),
      { onBatch, createWorker: create(worker) }
    )
    await vi.waitFor(() => expect(onBatch).toHaveBeenCalledOnce())
    expect(worker.postMessage).toHaveBeenCalledTimes(10)
    release()
    await importing
    expect(worker.postMessage).toHaveBeenCalledTimes(12)
  })

  it('stops, and stops the worker, when a batch cannot be stored', async () => {
    const worker = fakeWorker()
    await expect(
      importImages(
        Array.from({ length: 12 }, () => new Blob()),
        {
          onBatch: () => Promise.reject(new Error('the disk is full')),
          createWorker: create(worker)
        }
      )
    ).rejects.toThrow('the disk is full')
    expect(worker.postMessage).toHaveBeenCalledTimes(10)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('sends the first frame of a video to the worker, and keeps the video itself to publish', async () => {
    const worker = fakeWorker()
    const frame = new Blob(['frame'], { type: 'image/jpeg' })
    const takeFrame = vi.fn(() => Promise.resolve({ frame, duration: 12.5 }))
    const video = new File(['moov'], 'clip.mov')
    const { images } = await run([video], { createWorker: create(worker), takeFrame })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ file: frame }))
    expect(images[0].video).toEqual({ type: 'video/quicktime', duration: 12.5 })
    expect(images[0].publish.type).toBe('video/quicktime')
    expect(images[0].publish.size).toBe(video.size)
    expect(images[0].original).toBe(video)
  })

  it('counts a video with no frame to take as a failed file', async () => {
    const takeFrame = vi.fn(() => Promise.reject(new Error('no decoder')))
    const result = await run([new File([''], 'clip.mp4', { type: 'video/mp4' }), new Blob()], {
      takeFrame
    })
    expect(result).toMatchObject({ failed: 1, images: [image] })
  })
})
