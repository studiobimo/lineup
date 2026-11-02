import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { usePlanner } from '@/features/planner/planner'

import { liveAccount, useConnection } from './connection'
import { accountsQuery, publishedQuery } from './queries'

/** What is live, less any post that is already on the board as a cell of its own (ADR-0018). */
export function usePublishedPosts(accountId: string | undefined) {
  const query = useQuery({ ...publishedQuery(accountId ?? ''), enabled: accountId !== undefined })
  const linked = usePlanner(({ board }) => board.posts)
  const { data, error, refetch } = query
  const posts = useMemo(() => {
    const posts = Object.values(linked ?? {})
    const onBoard = new Set(posts.flatMap(({ id, url }) => (url ? [id, url] : [id])))
    return data?.filter(({ id, url }) => !onBoard.has(id) && !(url && onBoard.has(url)))
  }, [data, linked])
  return { posts, error, refetch }
}

/** The account being planned for, with no request at all when this browser has no key. */
export function useConnectedAccount() {
  const accountId = liveAccount(useConnection())
  const { data: accounts } = useQuery({ ...accountsQuery, enabled: accountId !== undefined })
  const { posts: published = [] } = usePublishedPosts(accountId)
  return { account: accounts?.find(({ id }) => id === accountId), published }
}
