import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { bestEffort } from '@/lib/best-effort'

const seenKey = 'intro-seen'

function wasSeen() {
  try {
    return localStorage.getItem(seenKey) !== null
  } catch {
    return false
  }
}

const introStore = createStore(() => ({ open: !wasSeen() }))

export const useIntroOpen = () => useStore(introStore, ({ open }) => open)

export const showIntro = () => introStore.setState({ open: true })

export function dismissIntro() {
  introStore.setState({ open: false })
  bestEffort(() => localStorage.setItem(seenKey, '1'))
}
