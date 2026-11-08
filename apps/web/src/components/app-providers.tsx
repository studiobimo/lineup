import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import { AnchoredToastProvider, ToastProvider } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'

const TOOLTIP_DELAY_MS = 150

const loadMotion = () => import('@/lib/motion-features').then(({ features }) => features)

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadMotion} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delay={TOOLTIP_DELAY_MS}>
          <ToastProvider>
            <AnchoredToastProvider>{children}</AnchoredToastProvider>
          </ToastProvider>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  )
}
