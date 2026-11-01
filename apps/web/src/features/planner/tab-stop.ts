import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import type { Container } from './board'

/** The cell that Tab lands on in each container: the last one focused, so a return picks up there. */
const tabStops = createStore<Partial<Record<Container, string>>>(() => ({}))

export const useTabStop = (container: Container) => useStore(tabStops, (stops) => stops[container])

export const setTabStop = (container: Container, id: string) =>
  tabStops.setState({ [container]: id })
