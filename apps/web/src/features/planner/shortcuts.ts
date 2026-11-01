export type Shortcut = 'undo' | 'redo'

/** What the Help dialog lists. Each name is a key in the help catalog. */
export const shortcutList = [
  { action: 'undo', keys: ['mod', 'z'] },
  { action: 'redo', keys: ['mod', 'shift', 'z'] },
  { action: 'delete', keys: ['delete'] },
  { action: 'pickUp', keys: ['space'] },
  { action: 'move', keys: ['arrows'] },
  { action: 'insert', keys: ['shift'] },
  { action: 'cancel', keys: ['escape'] }
]

export const isDelete = ({ key }: Pick<KeyboardEvent, 'key'>) =>
  key === 'Delete' || key === 'Backspace'

type Keys = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

/** Command on a Mac and Control elsewhere, so both work on both. */
export function shortcutFor({ key, metaKey, ctrlKey, shiftKey, altKey }: Keys): Shortcut | null {
  if (!(metaKey || ctrlKey) || altKey) return null
  const letter = key.toLowerCase()
  if (letter === 'z') return shiftKey ? 'redo' : 'undo'
  return letter === 'y' && !shiftKey ? 'redo' : null
}
