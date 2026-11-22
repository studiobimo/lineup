import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const slotStore = createStore<{ slot: HTMLElement | null }>(() => ({ slot: null }))

const setSlot = (slot: HTMLElement | null) => slotStore.setState({ slot })

export function HeaderSlot() {
  return <div ref={setSlot} className="contents" />
}

export function HeaderPortal({ children }: { children: ReactNode }) {
  const slot = useStore(slotStore, (state) => state.slot)
  return slot ? createPortal(children, slot) : null
}
