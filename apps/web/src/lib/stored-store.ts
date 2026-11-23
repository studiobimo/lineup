import { createStore } from 'zustand/vanilla'
import { bestEffort } from '@/lib/best-effort'

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
    bestEffort(() => localStorage.setItem(key, JSON.stringify(store.getState())))
  }

  return { store, save }
}
