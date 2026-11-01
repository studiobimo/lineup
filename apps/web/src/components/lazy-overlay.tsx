import { type ReactNode, Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { toastManager } from '@/components/ui/toast'
import i18n from '@/i18n/config'

interface LazyOverlayProps {
  onClose: () => void
  children: ReactNode
}

/**
 * For a dialog that loads on demand. Its chunk can fail to arrive, on a dropped connection or after
 * a deploy, and an overlay has no place on the page to show that, so it closes and says so.
 */
export function LazyOverlay({ onClose, children }: LazyOverlayProps) {
  const fail = () => {
    onClose()
    toastManager.add({ type: 'error', title: i18n.t('errors.overlay') })
  }
  return (
    <ErrorBoundary fallback={null} onError={fail}>
      <Suspense>{children}</Suspense>
    </ErrorBoundary>
  )
}
