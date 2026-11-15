import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  Check,
  Layers,
  Lock,
  LockOpen,
  Maximize2,
  Trash2,
  Ungroup
} from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Menu, MenuItem, MenuPopup } from '@/components/ui/menu'
import { openAlbum } from '@/features/albums/album-store'
import { mayPost, useConnection } from '@/features/provider/connection'
import { openPost } from '@/features/provider/post-store'

import { containerOf, coverOf, isLocked, neighbour } from './board'
import { closeCellMenu, useCellMenu } from './cell-menu-store'
import { openLightbox } from './lightbox-store'
import { plannerStore } from './planner'
import { selectedCells, toggleSelected } from './selection-store'

const OVERLAP = -112

const neighbourOf = (cell: HTMLElement) =>
  (cell.nextElementSibling ?? cell.previousElementSibling) as HTMLElement | null

function PostItems({
  id,
  toTray,
  canSchedule,
  posted,
  locked
}: {
  id: string
  toTray: boolean
  canSchedule: boolean
  posted: boolean
  locked: boolean
}) {
  const { t } = useTranslation('planner')
  const LockToggle = locked ? LockOpen : Lock
  return (
    <>
      {posted && (
        <MenuItem onClick={() => openPost(id)}>
          <CalendarClock />
          {t('postDetails')}
        </MenuItem>
      )}
      {toTray && canSchedule && !posted && (
        <MenuItem onClick={() => openPost(id)}>
          <CalendarClock />
          {t('schedule')}
        </MenuItem>
      )}
      {toTray && !posted && (
        <MenuItem onClick={() => plannerStore.getState().toggleLock(id)}>
          <LockToggle />
          {t(locked ? 'unlock' : 'lock')}
        </MenuItem>
      )}
    </>
  )
}

function EditItems({
  id,
  album,
  toTray,
  earlier,
  later,
  leave
}: {
  id: string
  album: boolean
  toTray: boolean
  earlier?: string
  later?: string
  leave: (action: () => void) => void
}) {
  const { t } = useTranslation('planner')
  const swapWith = (other?: string) => {
    if (other) plannerStore.getState().swap(id, other)
  }
  return (
    <>
      <MenuItem disabled={!earlier} onClick={() => swapWith(earlier)}>
        <ArrowLeft />
        {t('moveEarlier')}
      </MenuItem>
      <MenuItem disabled={!later} onClick={() => swapWith(later)}>
        <ArrowRight />
        {t('moveLater')}
      </MenuItem>
      {album && (
        <MenuItem onClick={() => leave(() => plannerStore.getState().ungroup(id))}>
          <Ungroup />
          {t('ungroup')}
        </MenuItem>
      )}
      <MenuItem
        onClick={() =>
          leave(() =>
            toTray
              ? plannerStore.getState().move(id, 'tray')
              : plannerStore.getState().moveToStartOfGrid(id)
          )
        }
      >
        <ArrowRightLeft />
        {t(toTray ? 'moveToTray' : 'moveToGrid')}
      </MenuItem>
      <MenuItem onClick={() => leave(() => plannerStore.getState().remove([id]))}>
        <Trash2 />
        {t('remove')}
      </MenuItem>
    </>
  )
}

function OpenMenu({ id, cell }: { id: string; cell: HTMLElement }) {
  const { t } = useTranslation('planner')
  const returnTo = useRef<HTMLElement | null>(cell)
  const canSchedule = mayPost(useConnection())
  const { board } = plannerStore.getState()
  const toTray = containerOf(board, id) === 'grid'
  const locked = isLocked(board, id)
  const album = board.albums?.[id] !== undefined
  const posted = board.posts?.[id] !== undefined
  const earlier = neighbour(board, id, -1)
  const later = neighbour(board, id, 1)
  const leave = (action: () => void) => {
    returnTo.current = neighbourOf(cell)
    action()
  }
  return (
    <Menu open onOpenChange={(open) => !open && closeCellMenu()}>
      <MenuPopup anchor={cell} sideOffset={OVERLAP} finalFocus={returnTo}>
        <MenuItem onClick={() => openLightbox(coverOf(board, id))}>
          <Maximize2 />
          {t('openImage')}
        </MenuItem>
        {album && (
          <MenuItem onClick={() => openAlbum(id)}>
            <Layers />
            {t('openAlbum')}
          </MenuItem>
        )}
        <MenuItem onClick={() => toggleSelected(id)}>
          <Check />
          {t(selectedCells().includes(id) ? 'deselect' : 'select')}
        </MenuItem>
        <PostItems
          id={id}
          toTray={toTray}
          canSchedule={canSchedule}
          posted={posted}
          locked={locked}
        />
        {!locked && (
          <EditItems
            id={id}
            album={album}
            toTray={toTray}
            earlier={earlier}
            later={later}
            leave={leave}
          />
        )}
      </MenuPopup>
    </Menu>
  )
}

export function CellMenu() {
  const open = useCellMenu()
  return open && <OpenMenu key={open.id} {...open} />
}
