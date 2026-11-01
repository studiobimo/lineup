import type { ImageTask } from '@/features/planner/import-images'
import { colourOf, processImage } from '@/features/planner/process-image'

// Null is any file that would not decode: the batch goes on without it.
self.addEventListener('message', ({ data: { kind, file } }: MessageEvent<ImageTask>) => {
  const work = kind === 'colour' ? colourOf(file) : processImage(file)
  work.then(
    (image) => self.postMessage(image),
    () => self.postMessage(null)
  )
})
