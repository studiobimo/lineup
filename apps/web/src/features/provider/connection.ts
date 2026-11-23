import { useStore } from 'zustand'

import { createStoredStore } from '@/lib/stored-store'

interface Connection {
  last4?: string
  expiresAt?: string
  canPost?: boolean
  accountId?: string
  username?: string
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined)

const { store, save } = createStoredStore<Connection>(
  'provider-connection',
  ({ last4, expiresAt, canPost, accountId, username }) => ({
    last4: text(last4),
    expiresAt: text(expiresAt),
    canPost: typeof canPost === 'boolean' ? canPost : undefined,
    accountId: text(accountId),
    username: text(username)
  })
)

export const useConnection = () => useStore(store)

export const saveConnection = save

export const forgetConnection = () =>
  save({
    last4: undefined,
    expiresAt: undefined,
    canPost: undefined,
    accountId: undefined,
    username: undefined
  })

export const hasLiveKey = ({ expiresAt }: Connection) =>
  expiresAt !== undefined && Date.parse(expiresAt) > Date.now()

export const mayPost = (connection: Connection) =>
  hasLiveKey(connection) && connection.canPost !== false

export const liveAccount = (connection: Connection) =>
  hasLiveKey(connection) ? connection.accountId : undefined
