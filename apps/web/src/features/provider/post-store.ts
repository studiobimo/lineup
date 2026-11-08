import { createOpenStore } from '@/lib/open-store'

export const { useOpen: useOpenPost, open: openPost, close: closePost } = createOpenStore<string>()
