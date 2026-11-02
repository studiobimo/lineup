import type { Board } from './board-store'

const KEY = 'lineup-unsaved-board'

export interface BoardJournal {
  write(board: Board): void
  read(): Board | undefined
  clear(): void
}

const isBoard = (value: Partial<Board> | null): value is Board =>
  Array.isArray(value?.tray) && Array.isArray(value?.grid)

/**
 * The board while its save is on the way (ADR-0016). A store's writes take time that a closing tab
 * does not have, and this one is synchronous, so it is done by the time the change is on screen.
 * Blocked or full storage leaves a board no worse off than it would be without this.
 */
export const boardJournal: BoardJournal = {
  write(board) {
    try {
      localStorage.setItem(KEY, JSON.stringify(board))
    } catch {
      this.clear()
    }
  },

  read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Board> | null
      return isBoard(saved) ? saved : undefined
    } catch {
      return undefined
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // Nothing to clear if storage is blocked.
    }
  }
}
