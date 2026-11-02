import type { Announcements } from '@dnd-kit/core'
import type { TFunction } from 'i18next'

import { containerOf } from './board'
import { plannerStore } from './planner'

type Place = (id: string) => string

export const placeOnBoard =
  (t: TFunction<'planner'>): Place =>
  (id) => {
    const { board } = plannerStore.getState()
    const container = containerOf(board, id)
    return t('place', { context: container, position: board[container].indexOf(id) + 1 })
  }

/** What a screen reader says, since the library would otherwise read out each cell's id. */
export function dragAnnouncements(t: TFunction<'planner'>, placeOf: Place): Announcements {
  const place = (id: string | number) => placeOf(String(id))
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
