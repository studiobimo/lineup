import { useStore } from 'zustand'

import { createStoredStore } from '@/lib/stored-store'

import { instagram } from './network-profile'

interface Profile {
  handle: string
  name: string
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

// With nothing usable stored, the preview falls back to its placeholders.
const { store, save } = createStoredStore<Profile>('profile', ({ handle, name }) => ({
  handle: text(handle),
  name: text(name)
}))

export const useProfile = () => useStore(store)

export const saveProfile = save

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
