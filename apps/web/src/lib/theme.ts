export type Theme = 'light' | 'dark'

const storageKey = 'theme'
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function savedTheme(): Theme | null {
  const saved = localStorage.getItem(storageKey)
  return saved === 'light' || saved === 'dark' ? saved : null
}

/** The theme chosen in the app, or the system's until one is. */
export function getTheme(): Theme {
  return savedTheme() ?? (systemDark().matches ? 'dark' : 'light')
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', getTheme() === 'dark')
  listeners.forEach((listener) => listener())
}

export function setTheme(theme: Theme) {
  localStorage.setItem(storageKey, theme)
  applyTheme()
}

export function subscribeToTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Runs before the first render, and keeps following the system. */
export function startTheme() {
  applyTheme()
  systemDark().addEventListener('change', applyTheme)
}
