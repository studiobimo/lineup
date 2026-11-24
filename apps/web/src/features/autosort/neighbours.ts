import type { BandCell } from './bands'

let current: BandCell[] = []

export const setNeighbours = (cells: BandCell[]) => {
  current = cells
}

export const getNeighbours = () => current
