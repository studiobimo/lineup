import { processImage } from '@/features/planner/process-image'

// Null is any file that would not decode: the batch goes on without it.
self.addEventListener('message', (event: MessageEvent<Blob>) => {
  processImage(event.data).then(
    (image) => self.postMessage(image),
    () => self.postMessage(null)
  )
})
