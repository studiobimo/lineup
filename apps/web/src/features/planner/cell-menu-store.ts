import { createOpenStore } from '@/lib/open-store'

export const {
  useOpen: useCellMenu,
  open: openCellMenu,
  close: closeCellMenu
} = createOpenStore<{ id: string; cell: HTMLElement }>()
