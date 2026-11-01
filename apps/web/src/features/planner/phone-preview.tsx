import { X } from 'lucide-react'
import { m } from 'motion/react'
import { type MouseEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import {
  Dialog,
  DialogBackdrop,
  DialogPortal,
  DialogPrimitive,
  DialogTitle
} from '@/components/ui/dialog'

import { settle } from './motion'
import { PhoneScreen } from './phone-screen'
import { useFitScale } from './use-fit-scale'

// A real phone's size in points, scaled as one piece, so what sits above the fold here sits above
// it there. Squeezing the layout to fit the window would show a phone that does not exist.
const SCREEN = { width: 390, height: 844 }
const BEZEL = 10
const WINDOW_MARGIN = 32

const SIDE_BUTTONS = [
  { side: 'left', top: 112, height: 28 },
  { side: 'left', top: 168, height: 56 },
  { side: 'left', top: 236, height: 56 },
  { side: 'right', top: 190, height: 88 }
] as const

export function PhonePreview({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('planner')
  const [leaving, setLeaving] = useState(false)
  const fit = useFitScale(SCREEN.width + BEZEL * 2, SCREEN.height + BEZEL * 2, WINDOW_MARGIN)
  const leave = () => setLeaving(true)
  const fade = { initial: { opacity: 0 }, animate: { opacity: leaving ? 0 : 1 } }
  const closeOutside = ({ target, currentTarget }: MouseEvent) => {
    if (target === currentTarget) leave()
  }
  return (
    <Dialog open onOpenChange={leave}>
      <DialogPortal>
        <DialogBackdrop className="transition-none" render={<m.div {...fade} />} />
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden outline-none"
          render={<m.div {...fade} />}
          onClick={closeOutside}
        >
          <DialogTitle className="sr-only">{t('phonePreview')}</DialogTitle>
          <m.div
            data-phone
            className="relative shrink-0 rounded-[3.75rem] bg-device shadow-2xl ring-1 ring-foreground/20"
            style={{ padding: BEZEL }}
            initial={{ y: 48, scale: fit * 0.96 }}
            animate={leaving ? { y: 24, scale: fit * 0.97 } : { y: 0, scale: fit }}
            transition={settle}
            onAnimationComplete={() => {
              if (leaving) onClose()
            }}
          >
            {SIDE_BUTTONS.map(({ side, top, height }) => (
              <span
                key={top}
                className="absolute w-[3px] bg-device ring-1 ring-foreground/20"
                style={{ top, height, [side]: -3 }}
              />
            ))}
            <div
              className="relative overflow-hidden rounded-[3.125rem]"
              style={{ width: SCREEN.width, height: SCREEN.height }}
            >
              <span className="absolute top-2.5 left-1/2 z-20 h-[2.125rem] w-[7.5rem] -translate-x-1/2 rounded-full bg-device" />
              <PhoneScreen />
            </div>
          </m.div>
          <IconButton
            variant="outline"
            className="absolute top-4 right-4"
            label={t('close')}
            onClick={leave}
          >
            <X />
          </IconButton>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
