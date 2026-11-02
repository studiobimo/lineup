import { Link } from '@tanstack/react-router'
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
import { useDialogPresence } from '@/hooks/use-dialog-presence'
import { isApple } from '@/lib/platform'

import { showIntro } from './intro-store'

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['settings', 'help'])
  const { dialog, close } = useDialogPresence(onClose)
  const label = (key: string) =>
    t(`help.keys.${key}`, { context: key === 'mod' && isApple() ? 'apple' : undefined })
  return (
    <Dialog {...dialog}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t('help:title')}</DialogTitle>
          <DialogDescription>{t('help.description')}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <h3 className="mb-2 text-sm font-medium">{t('help.shortcuts')}</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            {shortcutList.map(({ action, keys }) => (
              <div key={action} className="contents">
                <dt className="text-muted-foreground">{t(`help.actions.${action}`)}</dt>
                <dd className="flex gap-1">
                  {keys.map((key) => (
                    <Kbd key={key}>{label(key)}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogPanel>
        <DialogFooter className="sm:justify-between">
          {/* A tab of their own: leaving the planner would drop its undo history and any import. */}
          <div className="flex justify-center gap-1">
            <Button variant="link" size="sm" render={<Link to="/privacy" target="_blank" />}>
              {t('help.privacy')}
            </Button>
            <Button variant="link" size="sm" render={<Link to="/terms" target="_blank" />}>
              {t('help.terms')}
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              showIntro()
              close()
            }}
          >
            {t('help.showIntro')}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
