import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/components/app-shell'
import { TooltipProvider } from '@/components/ui/tooltip'

// Long enough that a pointer crossing a toolbar sets nothing off, and no longer. Once one tooltip
// is open, the provider opens its neighbours at once.
const TOOLTIP_DELAY_MS = 150

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout
})

function RootLayout() {
  return (
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
      <AppShell>
        <Outlet />
      </AppShell>
    </TooltipProvider>
  )
}
