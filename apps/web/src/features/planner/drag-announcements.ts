import type { Announcements } from '@dnd-kit/core'
import type { TFunction } from 'i18next'

import { plannerStore } from './planner'

/** What a screen reader says, since the library would otherwise read out each cell's id. */
export function dragAnnouncements(t: TFunction<'planner'>): Announcements {
  const place = (id: string | number) => {
    const { board } = plannerStore.getState()
    const container = board.tray.includes(String(id)) ? 'tray' : 'grid'
    const position = board[container].indexOf(String(id)) + 1
    return t('place', { context: container, position })
  }
  const isCell = (over: { data: { current?: { isCell?: boolean } } } | null) =>
    over?.data.current?.isCell

  return {
    onDragStart: ({ active }) => t('pickedUp', { place: place(active.id) }),
    onDragOver({ active, over }) {
      // Fires on pick-up too, and would talk over the words above.
      if (over?.id === active.id) return undefined
      return over && isCell(over) ? t('over', { place: place(over.id) }) : t('overNothing')
    },
    onDragEnd: ({ over }) => (over ? t('dropped') : t('droppedNowhere')),
    onDragCancel: () => t('dragCancelled')
  }
}
