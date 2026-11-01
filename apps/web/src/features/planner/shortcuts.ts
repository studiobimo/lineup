export type Shortcut = 'undo' | 'redo'

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
