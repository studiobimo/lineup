import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { site } from '@/config/site'

export const Route = createFileRoute('/')({
  component: HomeRoute
})

function HomeRoute() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="text-3xl font-semibold">{t('home.title', { name: site.name })}</h1>
      <p className="mt-2 text-muted-foreground">{t('home.description')}</p>
    </div>
  )
}
