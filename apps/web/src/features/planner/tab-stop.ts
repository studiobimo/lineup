import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import type { Container } from './board'

const tabStops = createStore<Partial<Record<Container, string>>>(() => ({}))

export const useTabStop = (container: Container) => useStore(tabStops, (stops) => stops[container])

export const setTabStop = (container: Container, id: string) =>
  tabStops.setState({ [container]: id })
