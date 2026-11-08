import type { Board } from './board-store'
import { bestEffort } from '@/lib/best-effort'

const KEY = 'lineup-unsaved-board'

export interface BoardJournal {
  write(board: Board): void
  read(): Board | undefined
  clear(): void
}

const isBoard = (value: Partial<Board> | null): value is Board =>
  Array.isArray(value?.tray) && Array.isArray(value?.grid)

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
    bestEffort(() => localStorage.removeItem(KEY))
  }
}
