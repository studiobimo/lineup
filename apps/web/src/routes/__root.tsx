import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/components/app-shell'
import { ShellActions } from '@/features/help/shell-actions'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout
})

function RootLayout() {
  return (
    <AppShell actions={<ShellActions />}>
      <Outlet />
    </AppShell>
  )
}
