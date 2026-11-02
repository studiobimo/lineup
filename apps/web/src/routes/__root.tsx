import { createRootRoute, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/components/app-shell'
import { ShellActions } from '@/features/help/shell-actions'

export const Route = createRootRoute({
  component: RootLayout
})

function RootLayout() {
  return (
    <AppShell actions={<ShellActions />}>
      <Outlet />
    </AppShell>
  )
}
