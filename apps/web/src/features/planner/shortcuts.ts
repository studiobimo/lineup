export type Shortcut = 'undo' | 'redo'

/** What the Help dialog lists, under the group each belongs to. Names are keys in the help catalog. */
export const shortcutList = [
  { group: 'history', action: 'undo', keys: ['mod', 'z'] },
  { group: 'history', action: 'redo', keys: ['mod', 'shift', 'z'] },
  { group: 'board', action: 'focus', keys: ['arrows'] },
  { group: 'board', action: 'actions', keys: ['enter'] },
  { group: 'board', action: 'delete', keys: ['delete'] },
  { group: 'moving', action: 'pickUp', keys: ['space'] },
  { group: 'moving', action: 'move', keys: ['arrows'] },
  { group: 'moving', action: 'insert', keys: ['shift'] },
  { group: 'moving', action: 'cancel', keys: ['escape'] }
] as const

export const shortcutGroups = ['history', 'board', 'moving'] as const

export const isDelete = ({ key }: Pick<KeyboardEvent, 'key'>) =>
  key === 'Delete' || key === 'Backspace'

/** The cell an arrow key lands on, by position, or null if there is none that way. */
export function cellStep(key: string, index: number, count: number, columns: number) {
  const target =
    {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      ArrowUp: index - columns,
      ArrowDown: index + columns,
      Home: 0,
      End: count - 1
    }[key] ?? -1
  return target >= 0 && target < count ? target : null
}

type Keys = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

/** Command on a Mac and Control elsewhere, so both work on both. */
export function shortcutFor({ key, metaKey, ctrlKey, shiftKey, altKey }: Keys): Shortcut | null {
  if (!(metaKey || ctrlKey) || altKey) return null
  const letter = key.toLowerCase()
  if (letter === 'z') return shiftKey ? 'redo' : 'undo'
  return letter === 'y' && !shiftKey ? 'redo' : null
}
