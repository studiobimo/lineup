import type { ProcessedImage } from './process-image'

export interface ImportResult {
  images: ProcessedImage[]
  failed: number
}

interface ImportOptions {
  onProgress?: (done: number, total: number) => void
  createWorker?: () => Worker
}

const createImportWorker = () =>
  new Worker(new URL('../../workers/image-import.worker.ts', import.meta.url), { type: 'module' })

function processInWorker(worker: Worker, file: Blob) {
  return new Promise<ProcessedImage>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<ProcessedImage | null>) => {
      if (data) resolve(data)
      else reject(new Error('The worker could not process this file'))
    }
    worker.onerror = reject
    worker.onmessageerror = reject
    worker.postMessage(file)
  })
}

/** One image at a time, so a large batch holds one decoded image at most. */
export async function importImages(
  files: Blob[],
  { onProgress, createWorker = createImportWorker }: ImportOptions = {}
): Promise<ImportResult> {
  const worker = createWorker()
  const images: ProcessedImage[] = []
  let failed = 0
  try {
    for (const [index, file] of files.entries()) {
      try {
        images.push(await processInWorker(worker, file))
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
