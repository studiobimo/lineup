import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { instagram } from './network-profile'

const storageKey = 'profile'

export interface Profile {
  handle: string
  name: string
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

// Storage can be blocked, or hold something older. Either way the preview falls back to placeholders.
function load(): Profile {
  try {
    const { handle, name } = JSON.parse(
      localStorage.getItem(storageKey) ?? '{}'
    ) as Partial<Profile>
    return { handle: text(handle), name: text(name) }
  } catch {
    return { handle: '', name: '' }
  }
}

const profileStore = createStore<Profile>(load)

export const useProfile = () => useStore(profileStore)

/** What people paste is an @name or a link to their profile, so both come down to the handle. */
export function toHandle(typed: string) {
  return typed
    .trim()
    .replace(/^.*instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, instagram.handleMaxLength)
}

export function saveProfile(changes: Partial<Profile>) {
  profileStore.setState(changes)
  try {
    localStorage.setItem(storageKey, JSON.stringify(profileStore.getState()))
  } catch {
    // It lasts until the page closes, and nothing else depends on it.
  }
}
