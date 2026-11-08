import { importSettings, type ImportSettings } from './import-settings'
import type { ProcessedImage } from './process-image'
import { firstFrame, videoTypeOf } from './video-frame'

export interface ImportResult {
  failed: number
}

interface ImportOptions {
  /** Takes each batch as it is ready, and the import waits for it, so storage sets the pace. */
  onBatch: (images: ProcessedImage[]) => Promise<void>
  onProgress?: (done: number, total: number) => void
  createWorker?: () => Worker
  /** For tests, which have no video decoder. */
  takeFrame?: typeof firstFrame
}

// Bounds how many processed images wait in memory and how many writes run at once, and lets a
// full disk stop an import after the first batch rather than after every image is processed.
const BATCH_SIZE = 10

export type ImageTask =
  { kind: 'process'; file: Blob; read: ImportSettings } | { kind: 'colour'; file: Blob }

export const createImageWorker = () =>
  new Worker(new URL('../../workers/image-import.worker.ts', import.meta.url), { type: 'module' })

export function runInWorker<Result>(worker: Worker, task: ImageTask) {
  return new Promise<Result>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<Result | null>) => {
      if (data) resolve(data)
      else reject(new Error('The worker could not process this file'))
    }
    worker.onerror = reject
    worker.onmessageerror = reject
    worker.postMessage(task)
  })
}

/** One image at a time, so a large import holds one decoded image and one small batch at most. */
export async function importImages(
  files: Blob[],
  { onBatch, onProgress, createWorker = createImageWorker, takeFrame = firstFrame }: ImportOptions
): Promise<ImportResult> {
  const worker = createWorker()
  const read = importSettings()
  let batch: ProcessedImage[] = []
  let failed = 0
  const flush = async () => {
    const ready = batch
    batch = []
    if (ready.length > 0) await onBatch(ready)
  }
  try {
    for (const [index, file] of files.entries()) {
      try {
        const type = videoTypeOf(file)
        if (type) {
          // The worker has no <video>, so a video's picture is taken here and goes in as a photo.
          const { frame, duration } = await takeFrame(file)
          const image = await runInWorker<ProcessedImage>(worker, {
            kind: 'process',
            file: frame,
            read
          })
          // The video is kept as it is, which the browser cannot re-encode (ADR-0022).
          const publish = file.slice(0, file.size, type)
          batch.push({ ...image, publish, video: { type, duration }, original: file })
        } else {
          const image = await runInWorker<ProcessedImage>(worker, { kind: 'process', file, read })
          batch.push({ ...image, original: file })
        }
      } catch {
        failed += 1
      }
      // Outside the try, which is for a file that will not decode, not for a full disk.
      if (batch.length === BATCH_SIZE) await flush()
      onProgress?.(index + 1, files.length)
    }
    await flush()
  } finally {
    worker.terminate()
  }
  return { failed }
}
