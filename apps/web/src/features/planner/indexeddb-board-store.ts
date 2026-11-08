import {
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
  type StoreNames
} from 'idb'

import {
  type Board,
  type BoardStore,
  emptyBoard,
  emptyHistory,
  type History,
  type ImageRecord,
  toRecord
} from './board-store'

interface LineupDb extends DBSchema {
  board: { key: 'current'; value: Board }
  history: { key: 'current'; value: History }
  images: { key: string; value: ImageRecord }
  thumbnails: { key: string; value: Blob }
  publishCopies: { key: string; value: Blob }
}

type Migration = (
  db: IDBPDatabase<LineupDb>,
  transaction: IDBPTransaction<LineupDb, StoreNames<LineupDb>[], 'versionchange'>
) => void | Promise<void>

export const migrations: Migration[] = [
  (db) => {
    db.createObjectStore('board')
    db.createObjectStore('images', { keyPath: 'id' })
    db.createObjectStore('thumbnails')
    db.createObjectStore('publishCopies')
  },
  (db) => {
    db.createObjectStore('history')
  }
]

export function createIndexedDbBoardStore(name = 'lineup', steps = migrations): BoardStore {
  let opening: Promise<IDBPDatabase<LineupDb>> | undefined

  const open = () =>
    (opening ??= openDB<LineupDb>(name, steps.length, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        for (const step of steps.slice(oldVersion)) await step(db, transaction)
      },
      blocking() {
        void opening?.then((db) => db.close())
        opening = undefined
      }
    }))

  return {
    async loadBoard() {
      const db = await open()
      return (await db.get('board', 'current')) ?? emptyBoard
    },

    async saveBoard(board) {
      const db = await open()
      await db.put('board', board, 'current')
    },

    async loadHistory() {
      const db = await open()
      return (await db.get('history', 'current')) ?? emptyHistory
    },

    async saveHistory(history) {
      const db = await open()
      await db.put('history', history, 'current')
    },

    async listImages() {
      const db = await open()
      return db.getAll('images')
    },

    async putImage(image) {
      const db = await open()
      const transaction = db.transaction(['images', 'thumbnails', 'publishCopies'], 'readwrite')
      await Promise.all([
        transaction.objectStore('images').put(toRecord(image)),
        transaction.objectStore('thumbnails').put(image.thumbnail, image.id),
        transaction.objectStore('publishCopies').put(image.publish, image.id),
        transaction.done
      ])
    },

    async setColour(id, colour) {
      const db = await open()
      const transaction = db.transaction('images', 'readwrite')
      const record = await transaction.store.get(id)
      if (record) await transaction.store.put({ ...record, colour })
      await transaction.done
    },

    async getThumbnail(id) {
      const db = await open()
      return db.get('thumbnails', id)
    },

    async getPublishCopy(id) {
      const db = await open()
      return db.get('publishCopies', id)
    },

    async deleteImages(ids) {
      const db = await open()
      const transaction = db.transaction(['images', 'thumbnails', 'publishCopies'], 'readwrite')
      await Promise.all([
        ...ids.flatMap((id) => [
          transaction.objectStore('images').delete(id),
          transaction.objectStore('thumbnails').delete(id),
          transaction.objectStore('publishCopies').delete(id)
        ]),
        transaction.done
      ])
    },

    async requestPersistence() {
      return (await navigator.storage?.persist?.()) ?? false
    },

    async storageUsage() {
      const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {}
      return { used: usage, quota }
    }
  }
}
