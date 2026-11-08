import { HardDrive, ImageIcon, Plug, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { StorageUsage } from '@/features/planner/board-store'
import { useFolder } from '@/features/planner/folder-board'
import { saveImportSettings, useImportSettings } from '@/features/planner/import-settings'
import { instagram } from '@/features/planner/network-profile'
import { boardStore } from '@/features/planner/planner'
import { saveProfile, toHandle, useProfile } from '@/features/planner/profile-store'
import { ProviderSettings } from '@/features/provider/provider-settings'
import i18n, { languages, setLanguage } from '@/i18n/config'
import { isInstalled, isSafari } from '@/lib/platform'
import { getTheme, setTheme, subscribeToTheme, type Theme } from '@/lib/theme'

import { BackupActions } from './backup-actions'
import { FolderSettings } from './folder-settings'
import { DialogNote, DialogSection, DialogStack } from './dialog-sections'
import { TabbedDialog } from './tabbed-dialog'

const themes: Theme[] = ['light', 'dark']

const size = (bytes: number) =>
  new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: 'unit',
    unit: bytes < 1e9 ? 'megabyte' : 'gigabyte',
    maximumFractionDigits: 1
  }).format(bytes / (bytes < 1e9 ? 1e6 : 1e9))

function AppearanceSettings() {
  const { t } = useTranslation('settings')
  const theme = useSyncExternalStore(subscribeToTheme, getTheme)
  const current = i18n.resolvedLanguage
  return (
    <DialogSection title={t('appearance')}>
      <Field className="flex-row items-center justify-between gap-4">
        <FieldLabel>{t('theme')}</FieldLabel>
        <ToggleGroup
          variant="outline"
          aria-label={t('theme')}
          value={[theme]}
          onValueChange={([next]) => next && setTheme(next as Theme)}
        >
          {themes.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {t(`themes.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field className="flex-row items-center justify-between gap-4">
        <FieldLabel>{t('language')}</FieldLabel>
        <Select
          items={languages.map((language) => ({
            value: language,
            label: t(`languages.${language}`)
          }))}
          value={current}
          onValueChange={(language) => language && setLanguage(language)}
        >
          <SelectTrigger className="w-40" aria-label={t('language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {languages.map((language) => (
              <SelectItem key={language} value={language} lang={language}>
                {t(`languages.${language}`)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </Field>
    </DialogSection>
  )
}

function ProfileSettings() {
  const { t } = useTranslation('settings')
  const { handle, name } = useProfile()
  return (
    <DialogSection title={t('profile')} description={t('profileNote')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="profile-name">{t('name')}</FieldLabel>
          <Input
            id="profile-name"
            value={name}
            maxLength={instagram.nameMaxLength}
            placeholder={t('namePlaceholder')}
            autoComplete="off"
            onChange={({ target }) => saveProfile({ name: target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-handle">{t('handle')}</FieldLabel>
          <Input
            id="profile-handle"
            value={handle}
            placeholder={t('handlePlaceholder')}
            autoComplete="off"
            spellCheck={false}
            onChange={({ target }) => saveProfile({ handle: toHandle(target.value) })}
          />
        </Field>
      </div>
    </DialogSection>
  )
}

function PhotoSettings() {
  const { t } = useTranslation('settings')
  const { readCaptureDates, readLocations } = useImportSettings()
  return (
    <DialogSection>
      <Field>
        <FieldLabel className="w-full justify-between font-normal">
          {t('captureDates')}
          <Switch
            checked={readCaptureDates}
            onCheckedChange={(checked) => saveImportSettings({ readCaptureDates: checked })}
          />
        </FieldLabel>
      </Field>
      <Field>
        <FieldLabel className="w-full justify-between font-normal">
          {t('locations')}
          <Switch
            checked={readLocations}
            onCheckedChange={(checked) => saveImportSettings({ readLocations: checked })}
          />
        </FieldLabel>
      </Field>
      <DialogNote>{t('photosNote')}</DialogNote>
    </DialogSection>
  )
}

function StorageSettings({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation('settings')
  const [usage, setUsage] = useState<StorageUsage>()
  const inFolder = useFolder().status === 'open'

  useEffect(() => {
    boardStore.storageUsage().then(setUsage, () => undefined)
  }, [inFolder])

  return (
    <DialogStack>
      {!inFolder && (
        <DialogSection
          title={t('storage')}
          description={
            <>
              <p>{t('storageNote')}</p>
              {isSafari() && !isInstalled() && <p className="mt-1.5">{t('safariNote')}</p>}
            </>
          }
        >
          {usage && (
            <Progress value={usage.used} max={usage.quota} aria-label={t('storage')}>
              <p className="text-sm text-muted-foreground">
                {t('storageUsed', { used: size(usage.used), quota: size(usage.quota) })}
              </p>
            </Progress>
          )}
        </DialogSection>
      )}
      <FolderSettings onOffered={onLeave} />
      <DialogSection title={t('backupTitle')} description={t('backupNote')}>
        <BackupActions onRestored={onLeave} />
      </DialogSection>
    </DialogStack>
  )
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings')
  return (
    <TabbedDialog
      title={t('title')}
      onClose={onClose}
      tabs={[
        {
          value: 'general',
          label: t('tabs.general'),
          icon: SlidersHorizontal,
          content: () => (
            <DialogStack>
              <ProfileSettings />
              <AppearanceSettings />
            </DialogStack>
          )
        },
        {
          value: 'photos',
          label: t('tabs.photos'),
          icon: ImageIcon,
          content: () => <PhotoSettings />
        },
        {
          value: 'storage',
          label: t('tabs.storage'),
          icon: HardDrive,
          content: (close) => <StorageSettings onLeave={close} />
        },
        {
          value: 'integrations',
          label: t('tabs.integrations'),
          icon: Plug,
          content: () => <ProviderSettings />
        }
      ]}
    />
  )
}
