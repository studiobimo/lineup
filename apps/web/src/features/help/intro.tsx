import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'

import { dismissIntro, useIntroOpen } from './intro-store'

const steps = ['add', 'arrange', 'preview'] as const

export function Intro() {
  const { t } = useTranslation('help')
  const open = useIntroOpen()
  if (!open) return null
  return (
    <div
      role="region"
      aria-label={t('introTitle')}
      className="relative mx-4 mt-4 rounded-lg border bg-card p-4 pe-12 text-card-foreground"
    >
      <h2 className="text-lg">{t('introTitle')}</h2>
      <ol className="mt-2 list-inside list-decimal text-sm text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{t(`introSteps.${step}`)}</li>
        ))}
      </ol>
      <IconButton
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2"
        label={t('introDismiss')}
        onClick={dismissIntro}
      >
        <X />
      </IconButton>
    </div>
  )
}
