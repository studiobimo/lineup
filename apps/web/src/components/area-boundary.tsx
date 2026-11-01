import type { ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

function AreaError({ resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-start gap-2 p-4 text-sm">
      <p className="text-muted-foreground">{t('errors.area')}</p>
      <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
        {t('errors.retry')}
      </Button>
    </div>
  )
}

/** Keeps a crash inside one part of the page, so the rest stays usable. */
export function AreaBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary FallbackComponent={AreaError}>{children}</ErrorBoundary>
}
