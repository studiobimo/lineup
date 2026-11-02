import { createOpenStore } from '@/lib/open-store'

/** The cell whose post is open, from wherever it was opened. */
export const { useOpen: useOpenPost, open: openPost, close: closePost } = createOpenStore<string>()
