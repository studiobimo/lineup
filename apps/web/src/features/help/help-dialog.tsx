import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { shortcutList } from '@/features/planner/shortcuts'
import { isApple } from '@/lib/platform'

import { showIntro } from './intro-store'

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('help')
  const label = (key: string) =>
    t(`keys.${key}`, { context: key === 'mod' && isApple() ? 'apple' : undefined })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <h3 className="mb-2 text-sm font-medium">{t('shortcuts')}</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            {shortcutList.map(({ action, keys }) => (
              <div key={action} className="contents">
                <dt className="text-muted-foreground">{t(`actions.${action}`)}</dt>
                <dd className="flex gap-1">
                  {keys.map((key) => (
                    <Kbd key={key}>{label(key)}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogPanel>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              showIntro()
              onClose()
            }}
          >
            {t('showIntro')}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
