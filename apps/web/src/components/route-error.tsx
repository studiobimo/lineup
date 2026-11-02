import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'

/** The shell stays up around this, so the header and its buttons still work. */
export function RouteError() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <Empty className="min-h-[calc(100dvh-3.5rem)]">
      <EmptyHeader>
        <EmptyTitle>
          <h1>{t('errors.routeTitle')}</h1>
        </EmptyTitle>
        <EmptyDescription>{t('errors.routeDescription')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => void router.invalidate()}>{t('errors.retry')}</Button>
      </EmptyContent>
    </Empty>
  )
}
