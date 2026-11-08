import { type ReactNode, Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import i18n from '@/i18n/config'
import { lastingToast } from '@/lib/lasting-toast'

interface LazyOverlayProps {
  name: string
  onClose: () => void
  children: ReactNode
}

export function LazyOverlay({ name, onClose, children }: LazyOverlayProps) {
  const fail = () => {
    onClose()
    lastingToast({ type: 'error', title: i18n.t('errors.overlay', { name }) })
  }
  return (
    <ErrorBoundary fallback={null} onError={fail}>
      <Suspense>{children}</Suspense>
    </ErrorBoundary>
  )
}
