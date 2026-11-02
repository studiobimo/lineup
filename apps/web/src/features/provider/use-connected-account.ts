import { useQuery } from '@tanstack/react-query'

import { liveAccount, useConnection } from './connection'
import { accountsQuery, publishedQuery } from './queries'

/** The account being planned for, with no request at all when this browser has no key. */
export function useConnectedAccount() {
  const accountId = liveAccount(useConnection())
  const enabled = accountId !== undefined
  const { data: accounts } = useQuery({ ...accountsQuery, enabled })
  const { data: published = [] } = useQuery({ ...publishedQuery(accountId ?? ''), enabled })
  return { account: accounts?.find(({ id }) => id === accountId), published }
}
