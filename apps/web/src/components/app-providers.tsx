import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import { ToastProvider } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'

// Long enough that a pointer crossing a toolbar sets nothing off, and no longer. Once one tooltip
// is open, the provider opens its neighbours at once.
const TOOLTIP_DELAY_MS = 150

// After first paint, because this is most of Motion's weight and nothing moves until then.
const loadMotion = () => import('@/lib/motion-features').then(({ features }) => features)

interface AppProvidersProps {
  queryClient: QueryClient
  children: ReactNode
}

/** Everything the app needs around it, in one place. A new provider belongs here. */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={loadMotion} strict>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delay={TOOLTIP_DELAY_MS}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  )
}
