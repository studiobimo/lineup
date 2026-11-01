import { ArrowRightLeft, Lock, LockOpen, Maximize2, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Menu, MenuItem, MenuPopup } from '@/components/ui/menu'

import { containerOf, isLocked } from './board'
import { closeCellMenu, useCellMenu } from './cell-menu-store'
import { openLightbox } from './lightbox-store'
import { plannerStore } from './planner'

// Into the cell's lower edge, so the menu reads as belonging to it and not to the row below.
const OVERLAP = -112

/** The cell focus moves to when this one leaves its container, so a run of actions carries on. */
const neighbourOf = (cell: HTMLElement) =>
  (cell.nextElementSibling ?? cell.previousElementSibling) as HTMLElement | null

function OpenMenu({ id, cell }: { id: string; cell: HTMLElement }) {
  const { t } = useTranslation('planner')
  const returnTo = useRef<HTMLElement | null>(cell)
  const { board } = plannerStore.getState()
  const toTray = containerOf(board, id) === 'grid'
  const locked = isLocked(board, id)
  const LockToggle = locked ? LockOpen : Lock
  const leave = (action: () => void) => {
    returnTo.current = neighbourOf(cell)
    action()
  }
  return (
    <Menu open onOpenChange={(open) => !open && closeCellMenu()}>
      <MenuPopup anchor={cell} sideOffset={OVERLAP} finalFocus={returnTo}>
        <MenuItem onClick={() => openLightbox(id)}>
          <Maximize2 />
          {t('openImage')}
        </MenuItem>
        {toTray && (
          <MenuItem onClick={() => plannerStore.getState().toggleLock(id)}>
            <LockToggle />
            {t(locked ? 'unlock' : 'lock')}
          </MenuItem>
        )}
        {!locked && (
          <>
            <MenuItem
              onClick={() =>
                leave(() => plannerStore.getState().move(id, toTray ? 'tray' : 'grid'))
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
        )}
      </MenuPopup>
    </Menu>
  )
}

/** One for the page, opened from the keyboard: a menu per cell is hundreds of roots for nothing. */
export function CellMenu() {
  const open = useCellMenu()
  return open && <OpenMenu key={open.id} {...open} />
}
