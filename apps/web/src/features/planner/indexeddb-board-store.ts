import {
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
  type StoreNames
} from 'idb'

import { type Board, type BoardStore, emptyBoard, type ImageRecord } from './board-store'

interface LineupDb extends DBSchema {
  board: { key: 'current'; value: Board }
  // Apart from the records, so that listing them never reads a blob.
  images: { key: string; value: ImageRecord }
  thumbnails: { key: string; value: Blob }
  publishCopies: { key: string; value: Blob }
}

type Migration = (
  db: IDBPDatabase<LineupDb>,
  transaction: IDBPTransaction<LineupDb, StoreNames<LineupDb>[], 'versionchange'>
) => void | Promise<void>

/**
 * One entry per schema version, in order, and never edited once released: a change appends a
 * migration, with a test that opens a board saved by the release before it.
 */
export const migrations: Migration[] = [
  (db) => {
    db.createObjectStore('board')
    db.createObjectStore('images', { keyPath: 'id' })
    db.createObjectStore('thumbnails')
    db.createObjectStore('publishCopies')
  }
]

export function createIndexedDbBoardStore(name = 'lineup', steps = migrations): BoardStore {
  let opening: Promise<IDBPDatabase<LineupDb>> | undefined

  const open = () =>
    (opening ??= openDB<LineupDb>(name, steps.length, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        for (const step of steps.slice(oldVersion)) await step(db, transaction)
      },
      // A newer release is open in another tab, and it cannot upgrade until this one lets go.
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

    async listImages() {
      const db = await open()
      return db.getAll('images')
    },

    async putImage({ thumbnail, publish, ...record }) {
      const db = await open()
      // One transaction: a crash cannot leave a record without its bytes.
      const transaction = db.transaction(['images', 'thumbnails', 'publishCopies'], 'readwrite')
      await Promise.all([
        transaction.objectStore('images').put(record),
        transaction.objectStore('thumbnails').put(thumbnail, record.id),
        transaction.objectStore('publishCopies').put(publish, record.id),
        transaction.done
      ])
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
    }
  }
}
