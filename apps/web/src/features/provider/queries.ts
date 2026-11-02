import { queryOptions } from '@tanstack/react-query'

import { answer, providerApi, worthRetrying } from './api'

/** Everything from the provider, to be dropped at once when the key goes. */
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
