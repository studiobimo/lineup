import {
  ArrowRightLeft,
  CalendarClock,
  Check,
  Layers,
  Lock,
  LockOpen,
  type LucideIcon,
  Maximize2,
  MoreHorizontal,
  Trash2
} from 'lucide-react'
import { type ComponentProps, memo } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { openAlbum } from '@/features/albums/album-store'
import { mayPost, useConnection } from '@/features/provider/connection'
import { openPost } from '@/features/provider/post-store'
import { cn } from '@/lib/utils'

import { type Container, coverOf } from './board'
import { openCellMenu } from './cell-menu-store'
import { cellTooltip } from './cell-tooltip'
import { openLightbox } from './lightbox-store'
import { plannerStore } from './planner'
import { toggleSelected } from './selection-store'

interface CellActionsProps {
  id: string
  container: Container
  locked: boolean
  /** A post holds the cell, so neither locking nor scheduling means anything here. */
  posted: boolean
}

interface CellBadgeProps {
  icon: LucideIcon
  label?: string
  /** Shown beside the icon. `label` says it in full to a screen reader. */
  text?: string
}

export function CellBadge({ icon: Icon, label, text }: CellBadgeProps) {
  return (
    <span className="flex items-center gap-0.5 rounded-sm bg-background p-1 text-xs/3 text-foreground shadow-xs">
      <Icon aria-hidden className="size-3" />
      {text && <span aria-hidden={label ? true : undefined}>{text}</span>}
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

/** For the mouse: the keyboard has Enter on the cell, or these would be more tab stops per image. */
export function CellButton(props: ComponentProps<typeof IconButton>) {
  return (
    <IconButton variant="outline" size="icon-xs" tabIndex={-1} tooltip={cellTooltip} {...props} />
  )
}

/** Memoised, because every cell renders when one moves and these do not depend on position. */
export const CellActions = memo(function CellActions({
  id,
  container,
  locked,
  posted
}: CellActionsProps) {
  const { t } = useTranslation('planner')
  const toTray = container === 'grid'
  const LockToggle = locked ? LockOpen : Lock
  const canSchedule = mayPost(useConnection())
  return (
    <div className="absolute inset-x-0 top-0 flex flex-wrap justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
      <CellButton
        label={t('openImage')}
        onClick={() => openLightbox(coverOf(plannerStore.getState().board, id))}
      >
        <Maximize2 />
      </CellButton>
      {toTray && canSchedule && !posted && (
        <CellButton label={t('schedule')} onClick={() => openPost(id)}>
          <CalendarClock />
        </CellButton>
      )}
      {toTray && !posted && (
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
          {/* What a drag does, for those who cannot drag (WCAG 2.5.7), is in the cell's menu. */}
          <CellButton
            label={t('moreActions')}
            onClick={({ currentTarget }) => {
              const cell = currentTarget.closest<HTMLElement>('[data-drop-id]')
              if (cell) openCellMenu({ id, cell })
            }}
          >
            <MoreHorizontal />
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
