import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const lightboxStore = createStore<{ id: string | null }>(() => ({ id: null }))

export const useLightboxId = () => useStore(lightboxStore, ({ id }) => id)

export const openLightbox = (id: string) => lightboxStore.setState({ id })

export const closeLightbox = () => lightboxStore.setState({ id: null })
