import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { usePageTitle } from '@/hooks/use-page-title'

export function NotFound() {
  const { t } = useTranslation()
  const title = t('errors.notFoundTitle')
  usePageTitle(title)
  return (
    <Empty className="min-h-[calc(100dvh-3.5rem)]">
      <EmptyHeader>
        <EmptyTitle>
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{t('errors.notFoundDescription')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/" />}>{t('errors.backToBoard')}</Button>
      </EmptyContent>
    </Empty>
  )
}
