import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const albumStore = createStore<{ id: string | null }>(() => ({ id: null }))

export const useOpenAlbumId = () => useStore(albumStore, ({ id }) => id)

export const openAlbum = (id: string) => albumStore.setState({ id })

export const closeAlbum = () => albumStore.setState({ id: null })
