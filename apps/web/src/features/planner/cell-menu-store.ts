import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

interface OpenCellMenu {
  id: string
  cell: HTMLElement
}

const cellMenuStore = createStore<OpenCellMenu | null>(() => null)

export const useCellMenu = () => useStore(cellMenuStore)

export const openCellMenu = (id: string, cell: HTMLElement) =>
  cellMenuStore.setState({ id, cell }, true)

export const closeCellMenu = () => cellMenuStore.setState(null, true)
