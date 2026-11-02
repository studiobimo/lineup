import { createOpenStore } from '@/lib/open-store'

export const {
  useOpen: useOpenAlbumId,
  open: openAlbum,
  close: closeAlbum
} = createOpenStore<string>()
