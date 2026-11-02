import { useStore } from 'zustand'

import { createStoredStore } from '@/lib/stored-store'

interface Connection {
  /** All this browser may know of the key, which only the Worker can read (ADR-0008). */
  last4?: string
  expiresAt?: string
  canPost?: boolean
  accountId?: string
  username?: string
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined)

// A hint and no more: it is what lets someone with no key send no request at all (ADR-0018).
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

/** Whether a schedule could go anywhere: a live key, unless it is known to be read-only. */
export const mayPost = (connection: Connection) =>
  hasLiveKey(connection) && connection.canPost !== false

export const liveAccount = (connection: Connection) =>
  hasLiveKey(connection) ? connection.accountId : undefined
