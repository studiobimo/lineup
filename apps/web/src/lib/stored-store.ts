import { createStore } from 'zustand/vanilla'

/**
 * A store that outlives the page in localStorage. Storage can be blocked, or hold something older,
 * so `revive` makes a whole state from whatever it finds, even nothing.
 */
export function createStoredStore<State extends object>(
  key: string,
  revive: (saved: Partial<State>) => State
) {
  function load() {
    try {
      return revive(JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<State>)
    } catch {
      return revive({})
    }
  }

  const store = createStore<State>(load)

  function save(changes: Partial<State>) {
    store.setState(changes)
    try {
      localStorage.setItem(key, JSON.stringify(store.getState()))
    } catch {
      // It lasts until the page closes, and nothing else depends on it.
    }
  }

  return { store, save }
}
