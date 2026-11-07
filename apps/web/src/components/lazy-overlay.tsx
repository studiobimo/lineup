import { type ReactNode, Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import i18n from '@/i18n/config'
import { lastingToast } from '@/lib/lasting-toast'

interface LazyOverlayProps {
  /** What failed to open, in the words of the message that says so. */
  name: string
  onClose: () => void
  children: ReactNode
}

/**
 * For a dialog that loads on demand. Its chunk can fail to arrive, on a dropped connection or after
 * a deploy, and an overlay has no place on the page to show that, so it closes and says so.
 */
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
