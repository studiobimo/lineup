import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** What one overlay has open, outside React, so that anything on the page can open it. */
export function createOpenStore<Value>() {
  const store = createStore<Value | null>(() => null)
  return {
    useOpen: () => useStore(store),
    open: (value: Value) => store.setState(value, true),
    close: () => store.setState(null, true)
  }
}
