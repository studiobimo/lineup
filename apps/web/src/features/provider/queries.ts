import { queryOptions } from '@tanstack/react-query'

import { answer, providerApi, worthRetrying } from './api'

export const PROVIDER_KEY = 'provider'

const MINUTE = 60_000

export const keyQuery = queryOptions({
  queryKey: [PROVIDER_KEY, 'key'],
  queryFn: () => answer(providerApi.key.$get()),
  retry: worthRetrying
})

export const accountsQuery = queryOptions({
  queryKey: [PROVIDER_KEY, 'accounts'],
  queryFn: async () => (await answer(providerApi.accounts.$get())).items,
  retry: worthRetrying,
  staleTime: MINUTE
})

export const postsQuery = (accountId: string) =>
  queryOptions({
    queryKey: [PROVIDER_KEY, 'scheduled', accountId],
    queryFn: async () => {
      const query = { accountId }
      return (await answer(providerApi['scheduled-posts'].$get({ query }))).items
    },
    retry: worthRetrying,
    refetchInterval: MINUTE
  })

export const publishedQuery = (accountId: string) =>
  queryOptions({
    queryKey: [PROVIDER_KEY, 'published', accountId],
    queryFn: async () => {
      const param = { id: accountId }
      return (await answer(providerApi.accounts[':id'].posts.$get({ param }))).items
    },
    retry: worthRetrying,
    staleTime: 5 * MINUTE
  })
