import { Check, Layers, type LucideIcon, MoreHorizontal } from 'lucide-react'
import { type ComponentProps, memo } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { openAlbum } from '@/features/albums/album-store'
import { mayPost, useConnection } from '@/features/provider/connection'
import { cn } from '@/lib/utils'

import type { Container } from './board'
import { cellContext, selectLabel, visibleActions } from './cell-actions'
import { openCellMenu } from './cell-menu-store'
import { cellTooltip } from './cell-tooltip'
import { toggleSelected } from './selection-store'

interface CellActionsProps {
  id: string
  container: Container
  locked: boolean
  posted: boolean
}

interface CellBadgeProps {
  icon: LucideIcon
  label?: string
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

export function CellButton(props: ComponentProps<typeof IconButton>) {
  return <IconButton size="icon-xs" tabIndex={-1} tooltip={cellTooltip} {...props} />
}

export const CellActions = memo(function CellActions({
  id,
  container,
  locked,
  posted
}: CellActionsProps) {
  const { t } = useTranslation('planner')
  const canSchedule = mayPost(useConnection())
  const context = cellContext({ id, container, locked, posted, canSchedule })
  const actions = visibleActions('controls', context)
  return (
    <div className="absolute inset-x-0 top-0 flex flex-wrap justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
      {actions.map(({ key, action }) => {
        const Icon = action.icon(context)
        return (
          <CellButton
            key={key}
            label={t(action.label(context))}
            onClick={() => action.run(context)}
          >
            <Icon />
          </CellButton>
        )
      })}
      {!locked && (
        <CellButton
          label={t('moreActions')}
          onClick={({ currentTarget }) => {
            const cell = currentTarget.closest<HTMLElement>('[data-drop-id]')
            if (cell) openCellMenu({ id, cell })
          }}
        >
          <MoreHorizontal />
        </CellButton>
      )}
    </div>
  )
})

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
      label={t(selectLabel(selected))}
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
