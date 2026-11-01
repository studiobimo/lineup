import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Group } from '@/components/ui/group'
import { Progress } from '@/components/ui/progress'
import type { StorageUsage } from '@/features/planner/board-store'
import { boardStore } from '@/features/planner/planner'
import { getTheme, setTheme, subscribeToTheme, type Theme } from '@/lib/theme'

const themes: Theme[] = ['light', 'dark']

const size = (bytes: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: bytes < 1e9 ? 'megabyte' : 'gigabyte',
    maximumFractionDigits: 1
  }).format(bytes / (bytes < 1e9 ? 1e6 : 1e9))

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('help')
  const theme = useSyncExternalStore(subscribeToTheme, getTheme)
  const [usage, setUsage] = useState<StorageUsage>()

  useEffect(() => {
    void boardStore.storageUsage().then(setUsage)
  }, [])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('settings')}</DialogTitle>
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
            <h3 className="mb-2 text-sm font-medium">{t('storage')}</h3>
            {usage && (
              <Progress value={usage.used} max={usage.quota} aria-label={t('storage')}>
                <p className="text-sm text-muted-foreground">
                  {t('storageUsed', { used: size(usage.used), quota: size(usage.quota) })}
                </p>
              </Progress>
            )}
            <p className="mt-2 text-sm text-muted-foreground">{t('storageNote')}</p>
          </section>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
