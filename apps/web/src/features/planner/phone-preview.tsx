import { X } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import {
  Dialog,
  DialogBackdrop,
  DialogPortal,
  DialogPrimitive,
  DialogTitle
} from '@/components/ui/dialog'

import { cellShape, gridColumns } from './network-profile'
import { usePlanner } from './planner'
import { Thumbnail } from './thumbnail'
import { useNearViewport } from './use-near-viewport'

function PreviewCell({ id, position }: { id: string; position: number }) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const near = useNearViewport(cell)
  return (
    <div ref={cell} className="bg-muted" style={cellShape}>
      {near && <Thumbnail id={id} label={t('cell', { position })} />}
    </div>
  )
}

/** Blank bars, not sample numbers: nothing here is the user's until an account is connected. */
function ProfilePlaceholder() {
  return (
    <div aria-hidden className="flex items-center gap-6 p-4">
      <div className="size-20 shrink-0 rounded-full bg-muted" />
      <div className="flex flex-1 justify-between">
        {[0, 1, 2].map((stat) => (
          <div key={stat} className="flex flex-col items-center gap-1">
            <div className="h-4 w-8 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PhonePreview({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('planner')
  const grid = usePlanner(({ board }) => board.grid)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none">
          <DialogTitle className="sr-only">{t('phonePreview')}</DialogTitle>
          <IconButton
            variant="outline"
            className="absolute top-4 right-4"
            label={t('close')}
            onClick={onClose}
          >
            <X />
          </IconButton>
          <div
            data-scroll-root
            data-phone
            className="h-[min(44rem,85dvh)] w-[min(24rem,90vw)] overflow-y-auto rounded-[2.5rem] border-8 border-foreground bg-background"
          >
            <ProfilePlaceholder />
            {grid.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t('gridEmpty')}</p>
            ) : (
              <div className="grid gap-0.5" style={gridColumns}>
                {grid.map((id, index) => (
                  <PreviewCell key={id} id={id} position={index + 1} />
                ))}
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
