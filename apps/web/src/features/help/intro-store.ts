import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const seenKey = 'intro-seen'

// Storage can be blocked. Then the introduction shows on each visit, which is the safe way round.
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
  try {
    localStorage.setItem(seenKey, '1')
  } catch {
    // It comes back next visit, and nothing else depends on it.
  }
}
