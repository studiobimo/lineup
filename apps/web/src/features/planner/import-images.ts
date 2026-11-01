import type { ProcessedImage } from './process-image'

export interface ImportResult {
  images: ProcessedImage[]
  failed: number
}

interface ImportOptions {
  onProgress?: (done: number, total: number) => void
  createWorker?: () => Worker
}

export interface ImageTask {
  kind: 'process' | 'colour'
  file: Blob
}

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

/** One image at a time, so a large batch holds one decoded image at most. */
export async function importImages(
  files: Blob[],
  { onProgress, createWorker = createImageWorker }: ImportOptions = {}
): Promise<ImportResult> {
  const worker = createWorker()
  const images: ProcessedImage[] = []
  let failed = 0
  try {
    for (const [index, file] of files.entries()) {
      try {
        images.push(await runInWorker<ProcessedImage>(worker, { kind: 'process', file }))
      } catch {
        failed += 1
      }
      onProgress?.(index + 1, files.length)
    }
  } finally {
    worker.terminate()
  }
  return { images, failed }
}
