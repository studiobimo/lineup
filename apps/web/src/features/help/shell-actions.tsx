import { CircleHelp, Settings } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'

const HelpDialog = lazy(() =>
  import('./help-dialog').then(({ HelpDialog }) => ({ default: HelpDialog }))
)
const SettingsDialog = lazy(() =>
  import('./settings-dialog').then(({ SettingsDialog }) => ({ default: SettingsDialog }))
)

export function ShellActions() {
  const { t } = useTranslation('help')
  const [open, setOpen] = useState<'help' | 'settings' | null>(null)
  const close = () => setOpen(null)
  return (
    <>
      <IconButton variant="ghost" label={t('title')} onClick={() => setOpen('help')}>
        <CircleHelp />
      </IconButton>
      <IconButton variant="ghost" label={t('settings')} onClick={() => setOpen('settings')}>
        <Settings />
      </IconButton>
      <Suspense>
        {open === 'help' && <HelpDialog onClose={close} />}
        {open === 'settings' && <SettingsDialog onClose={close} />}
      </Suspense>
    </>
  )
}
