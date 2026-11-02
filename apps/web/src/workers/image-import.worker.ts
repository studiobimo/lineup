import type { ImageTask } from '@/features/planner/import-images'
import { colourOf, processImage } from '@/features/planner/process-image'

// Null is any file that would not decode: the batch goes on without it.
self.addEventListener('message', ({ data: task }: MessageEvent<ImageTask>) => {
  const work = task.kind === 'colour' ? colourOf(task.file) : processImage(task.file, task.read)
  work.then(
    (image) => self.postMessage(image),
    () => self.postMessage(null)
  )
})
