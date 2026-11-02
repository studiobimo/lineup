import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// One cache however many of these are on the page. Only the provider's screens use queries, and the
// first load is at its limit, so this comes with them and not with AppProviders.
const queryClient = new QueryClient()

export function ProviderQueries({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
