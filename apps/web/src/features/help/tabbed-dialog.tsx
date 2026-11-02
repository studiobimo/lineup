import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { useDialogPresence } from '@/hooks/use-dialog-presence'
import { useMediaQuery } from '@/hooks/use-media-query'

export interface DialogTab {
  value: string
  label: string
  icon: LucideIcon
  /** Given the way to close the dialog, for a tab whose action leaves it. */
  content: (close: () => void) => ReactNode
}

/**
 * The frame of Settings and Help: tabs down the side, or along the top where there is no room,
 * and one height for every tab, so the dialog does not jump as someone moves between them.
 */
export function TabbedDialog({
  title,
  description,
  tabs,
  onClose
}: {
  title: string
  description?: string
  tabs: DialogTab[]
  onClose: () => void
}) {
  const { dialog, close } = useDialogPresence(onClose)
  const wide = useMediaQuery('sm')
  return (
    <Dialog {...dialog}>
      <DialogPopup className="sm:h-128 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Tabs
          defaultValue={tabs[0]?.value}
          orientation={wide ? 'vertical' : 'horizontal'}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="max-sm:mx-6 max-sm:mb-3 max-sm:border-b sm:mb-6 sm:ms-6 sm:w-40 sm:shrink-0 sm:self-start sm:border-s">
            <TabsList variant="underline" className="max-sm:w-full">
              {tabs.map(({ value, label, icon: Icon }) => (
                <TabsTab key={value} value={value}>
                  <Icon aria-hidden="true" />
                  {/* Icons alone where the tabs run along the top, and the label is still read. */}
                  <span className="max-sm:sr-only">{label}</span>
                </TabsTab>
              ))}
            </TabsList>
          </div>
          <div className="min-h-0 min-w-0 flex-1">
            <DialogPanel>
              {tabs.map(({ value, content }) => (
                <TabsPanel key={value} value={value}>
                  {content(close)}
                </TabsPanel>
              ))}
            </DialogPanel>
          </div>
        </Tabs>
      </DialogPopup>
    </Dialog>
  )
}
