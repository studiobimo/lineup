import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export function createOpenStore<Value>() {
  const store = createStore<Value | null>(() => null)
  return {
    useOpen: () => useStore(store),
    open: (value: Value) => store.setState(value, true),
    close: () => store.setState(null, true)
  }
}
