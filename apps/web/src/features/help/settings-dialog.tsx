import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Group } from '@/components/ui/group'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import type { StorageUsage } from '@/features/planner/board-store'
import { useFolder } from '@/features/planner/folder-board'
import { saveImportSettings, useImportSettings } from '@/features/planner/import-settings'
import { instagram } from '@/features/planner/network-profile'
import { boardStore } from '@/features/planner/planner'
import { saveProfile, toHandle, useProfile } from '@/features/planner/profile-store'
import { useDialogPresence } from '@/hooks/use-dialog-presence'
import { isInstalled, isSafari } from '@/lib/platform'
import { getTheme, setTheme, subscribeToTheme, type Theme } from '@/lib/theme'

import { BackupActions } from './backup-actions'
import { FolderSettings } from './folder-settings'

const themes: Theme[] = ['light', 'dark']

const size = (bytes: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: bytes < 1e9 ? 'megabyte' : 'gigabyte',
    maximumFractionDigits: 1
  }).format(bytes / (bytes < 1e9 ? 1e6 : 1e9))

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings')
  const { dialog, close } = useDialogPresence(onClose)
  const theme = useSyncExternalStore(subscribeToTheme, getTheme)
  const [usage, setUsage] = useState<StorageUsage>()
  const { handle, name } = useProfile()
  const { readCaptureDates, readLocations } = useImportSettings()
  const inFolder = useFolder().status === 'open'

  useEffect(() => {
    void boardStore.storageUsage().then(setUsage)
  }, [inFolder])

  return (
    <Dialog {...dialog}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-6">
          <section>
            <h3 className="mb-2 text-sm font-medium">{t('theme')}</h3>
            <Group aria-label={t('theme')}>
              {themes.map((option) => (
                <Button
                  key={option}
                  variant={option === theme ? 'default' : 'outline'}
                  aria-pressed={option === theme}
                  onClick={() => setTheme(option)}
                >
                  {t(`themes.${option}`)}
                </Button>
              ))}
            </Group>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">{t('profile')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-handle">{t('handle')}</Label>
                <Input
                  id="profile-handle"
                  value={handle}
                  placeholder={t('handlePlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={({ target }) => saveProfile({ handle: toHandle(target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-name">{t('name')}</Label>
                <Input
                  id="profile-name"
                  value={name}
                  maxLength={instagram.nameMaxLength}
                  placeholder={t('namePlaceholder')}
                  autoComplete="off"
                  onChange={({ target }) => saveProfile({ name: target.value })}
                />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('profileNote')}</p>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">{t('photos')}</h3>
            <Label className="flex items-center justify-between gap-4 font-normal">
              {t('captureDates')}
              <Switch
                checked={readCaptureDates}
                onCheckedChange={(checked) => saveImportSettings({ readCaptureDates: checked })}
              />
            </Label>
            <Label className="mt-2 flex items-center justify-between gap-4 font-normal">
              {t('locations')}
              <Switch
                checked={readLocations}
                onCheckedChange={(checked) => saveImportSettings({ readLocations: checked })}
              />
            </Label>
            <p className="mt-2 text-sm text-muted-foreground">{t('photosNote')}</p>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">{t('storage')}</h3>
            {!inFolder && (
              <>
                {usage && (
                  <Progress value={usage.used} max={usage.quota} aria-label={t('storage')}>
                    <p className="text-sm text-muted-foreground">
                      {t('storageUsed', { used: size(usage.used), quota: size(usage.quota) })}
                    </p>
                  </Progress>
                )}
                <p className="mt-2 text-sm text-muted-foreground">{t('storageNote')}</p>
                {isSafari() && !isInstalled() && (
                  <p className="mt-2 text-sm text-muted-foreground">{t('safariNote')}</p>
                )}
              </>
            )}
            <FolderSettings />
            <BackupActions onRestored={close} />
            <p className="mt-2 text-sm text-muted-foreground">{t('backupNote')}</p>
          </section>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
