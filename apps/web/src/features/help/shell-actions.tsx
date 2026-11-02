import { CircleHelp, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { LazyOverlay } from '@/components/lazy-overlay'
import { loadStrings } from '@/i18n/load-strings'
import { lazyComponent } from '@/lib/lazy-component'

const settingsStrings = () => loadStrings('settings')
const HelpDialog = lazyComponent(
  () => import('./help-dialog').then(({ HelpDialog }) => HelpDialog),
  settingsStrings
)
const SettingsDialog = lazyComponent(
  () => import('./settings-dialog').then(({ SettingsDialog }) => SettingsDialog),
  settingsStrings,
  () => loadStrings('provider')
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
      {open && (
        <LazyOverlay name={t(open === 'help' ? 'title' : 'settings')} onClose={close}>
          {open === 'help' ? <HelpDialog onClose={close} /> : <SettingsDialog onClose={close} />}
        </LazyOverlay>
      )}
    </>
  )
}
