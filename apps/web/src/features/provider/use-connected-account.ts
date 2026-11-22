import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { usePlanner } from '@/features/planner/planner'

import { liveAccount, useConnection } from './connection'
import { accountsQuery, publishedQuery } from './queries'

export function usePublishedPosts(accountId: string | undefined) {
  const query = useQuery({ ...publishedQuery(accountId ?? ''), enabled: accountId !== undefined })
  const linked = usePlanner(({ board }) => board.posts)
  const { data, error, refetch } = query
  const posts = useMemo(() => {
    // ~keep
    // Only until the sync drops the cell, which is in the same render as the copy appearing.
    const posts = Object.values(linked ?? {}).filter(({ status }) => status === 'published')
    const onBoard = new Set(posts.flatMap(({ id, url }) => (url ? [id, url] : [id])))
    return data?.filter(({ id, url }) => !onBoard.has(id) && !(url && onBoard.has(url)))
  }, [data, linked])
  return { posts, error, refetch }
}

export function useConnectedAccount() {
  const accountId = liveAccount(useConnection())
  const { data: accounts } = useQuery({ ...accountsQuery, enabled: accountId !== undefined })
  const { posts: published = [] } = usePublishedPosts(accountId)
  return { account: accounts?.find(({ id }) => id === accountId), published }
}
