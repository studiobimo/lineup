import type { ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function AreaError({ resetErrorBoundary, className }: FallbackProps & { className?: string }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-2 p-gutter text-sm', className)}>
      <p className="text-muted-foreground">{t('errors.area')}</p>
      <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
        {t('errors.retry')}
      </Button>
    </div>
  )
}

export function AreaBoundary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ErrorBoundary fallbackRender={(props) => <AreaError {...props} className={className} />}>
      {children}
    </ErrorBoundary>
  )
}
