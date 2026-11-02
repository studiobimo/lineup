import { ArrowRightLeft, Check, Layers, Lock, LockOpen, Maximize2, Trash2 } from 'lucide-react'
import { type ComponentProps, memo } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { openAlbum } from '@/features/albums/album-store'
import { cn } from '@/lib/utils'

import { type Container, coverOf } from './board'
import { cellTooltip } from './cell-tooltip'
import { openLightbox } from './lightbox-store'
import { plannerStore } from './planner'
import { toggleSelected } from './selection-store'

interface CellActionsProps {
  id: string
  container: Container
  locked: boolean
}

/** For the mouse: the keyboard has Enter on the cell, or these would be more tab stops per image. */
function CellButton(props: ComponentProps<typeof IconButton>) {
  return (
    <IconButton variant="outline" size="icon-xs" tabIndex={-1} tooltip={cellTooltip} {...props} />
  )
}

/** Memoised, because every cell renders when one moves and these do not depend on position. */
export const CellActions = memo(function CellActions({ id, container, locked }: CellActionsProps) {
  const { t } = useTranslation('planner')
  const toTray = container === 'grid'
  const LockToggle = locked ? LockOpen : Lock
  return (
    <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
      <CellButton
        label={t('openImage')}
        onClick={() => openLightbox(coverOf(plannerStore.getState().board, id))}
      >
        <Maximize2 />
      </CellButton>
      {toTray && (
        <CellButton
          label={t(locked ? 'unlock' : 'lock')}
          onClick={() => plannerStore.getState().toggleLock(id)}
        >
          <LockToggle />
        </CellButton>
      )}
      {!locked && (
        <>
          <CellButton
            label={t(toTray ? 'moveToTray' : 'moveToGrid')}
            onClick={() => plannerStore.getState().move(id, toTray ? 'tray' : 'grid')}
          >
            <ArrowRightLeft />
          </CellButton>
          <CellButton label={t('remove')} onClick={() => plannerStore.getState().remove([id])}>
            <Trash2 />
          </CellButton>
        </>
      )}
    </div>
  )
})

/** Always in view, unlike the actions: it says what the cell is, and opens what it says. */
export const AlbumButton = memo(function AlbumButton({ id, size }: { id: string; size: number }) {
  const { t } = useTranslation('planner')
  return (
    <>
      <CellButton
        size="xs"
        label={t('openAlbum')}
        className="pointer-events-auto gap-0.5 px-1 tabular-nums"
        onClick={() => openAlbum(id)}
      >
        <Layers />
        {size}
      </CellButton>
      <span className="sr-only">{t('albumOf', { count: size })}</span>
    </>
  )
})

/** In its own corner, because a narrow cell's actions already fill its top edge. */
export const SelectToggle = memo(function SelectToggle({
  id,
  selected
}: {
  id: string
  selected: boolean
}) {
  const { t } = useTranslation('planner')
  return (
    <CellButton
      variant="ghost"
      label={t(selected ? 'deselect' : 'select')}
      aria-pressed={selected}
      className={cn(
        'absolute right-1 bottom-1 rounded-full border-2 opacity-0 transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 pointer-coarse:opacity-100',
        selected
          ? 'border-primary bg-primary text-primary-foreground opacity-100 hover:border-primary/90 hover:bg-primary/90'
          : 'border-on-photo bg-photo-scrim text-transparent shadow-xs hover:bg-photo-scrim hover:text-on-photo'
      )}
      onClick={() => toggleSelected(id)}
    >
      <Check strokeWidth={3} className="opacity-100" />
    </CellButton>
  )
})
