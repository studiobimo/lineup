import { createOpenStore } from '@/lib/open-store'

export const {
  useOpen: useLightboxId,
  open: openLightbox,
  close: closeLightbox
} = createOpenStore<string>()
