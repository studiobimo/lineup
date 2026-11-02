import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Compass, Keyboard, Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { shortcutGroups, shortcutList } from '@/features/planner/shortcuts'
import { isApple } from '@/lib/platform'

import { DialogSection, DialogStack } from './dialog-sections'
import { showIntro } from './intro-store'
import { TabbedDialog } from './tabbed-dialog'

const introSteps = ['add', 'arrange', 'preview'] as const

function Shortcuts() {
  const { t } = useTranslation('settings')
  const label = (key: string) =>
    t(`help.keys.${key}`, { context: key === 'mod' && isApple() ? 'apple' : undefined })
  return (
    <DialogStack>
      {shortcutGroups.map((group) => (
        <DialogSection key={group} title={t(`help.groups.${group}`)}>
          <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
            {shortcutList
              .filter((shortcut) => shortcut.group === group)
              .map(({ action, keys }) => (
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
        </DialogSection>
      ))}
    </DialogStack>
  )
}

function Guide({ onShown }: { onShown: () => void }) {
  const { t } = useTranslation(['settings', 'help'])
  return (
    <DialogSection title={t('settings:help.guideTitle')}>
      <ol className="list-outside list-decimal space-y-1 ps-4 text-sm text-muted-foreground">
        {introSteps.map((step) => (
          <li key={step}>{t(`help:introSteps.${step}`)}</li>
        ))}
      </ol>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          showIntro()
          onShown()
        }}
      >
        {t('settings:help.showIntro')}
      </Button>
    </DialogSection>
  )
}

/** Each opens in a tab of its own: leaving the planner would drop its undo history and any import. */
function Legal() {
  const { t } = useTranslation('settings')
  return (
    <DialogSection title={t('help.legalTitle')} description={t('help.description')}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" render={<Link to="/privacy" target="_blank" />}>
          {t('help.privacy')}
          <ArrowUpRight aria-hidden="true" />
        </Button>
        <Button variant="outline" render={<Link to="/terms" target="_blank" />}>
          {t('help.terms')}
          <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
    </DialogSection>
  )
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['settings', 'help'])
  return (
    <TabbedDialog
      title={t('help:title')}
      onClose={onClose}
      tabs={[
        {
          value: 'shortcuts',
          label: t('settings:help.tabs.shortcuts'),
          icon: Keyboard,
          content: () => <Shortcuts />
        },
        {
          value: 'guide',
          label: t('settings:help.tabs.guide'),
          icon: Compass,
          content: (close) => <Guide onShown={close} />
        },
        {
          value: 'legal',
          label: t('settings:help.tabs.legal'),
          icon: Scale,
          content: () => <Legal />
        }
      ]}
    />
  )
}
