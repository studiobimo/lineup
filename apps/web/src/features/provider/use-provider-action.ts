import { useMutation, useQueryClient } from '@tanstack/react-query'

import { answer } from './api'
import { PROVIDER_KEY } from './queries'

type Request<Body> = Parameters<typeof answer<Body>>[0]

interface ProviderActionOptions<Body> {
  cache?: 'invalidate' | 'remove' | 'keep'
  onSuccess?: (body: Body) => void
  onError?: (error: Error) => void
}

export function useProviderAction<Input, Body>(
  request: (input: Input) => Request<Body>,
  { cache = 'invalidate', onSuccess, onError }: ProviderActionOptions<Body> = {}
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => answer(request(input)),
    onSuccess: (body) => {
      onSuccess?.(body)
      if (cache === 'remove') queryClient.removeQueries({ queryKey: [PROVIDER_KEY] })
    },
    onError,
    onSettled: () => {
      if (cache === 'invalidate') void queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY] })
    }
  })
}
