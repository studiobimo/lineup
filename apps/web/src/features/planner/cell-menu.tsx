import { ArrowLeft, ArrowRight, Layers, Ungroup } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Menu, MenuItem, MenuPopup } from '@/components/ui/menu'
import { openAlbum } from '@/features/albums/album-store'
import { mayPost, useConnection } from '@/features/provider/connection'

import { neighbour } from './board'
import { type ActionContext, boardCellContext } from './cell-actions'
import { closeCellMenu, useCellMenu } from './cell-menu-store'
import { plannerStore } from './planner'
import { type ActionRowsProps, useActionRows } from './use-action-rows'

const OVERLAP = -112

const neighbourOf = (cell: HTMLElement) =>
  (cell.nextElementSibling ?? cell.previousElementSibling) as HTMLElement | null

function AlbumItem({ id }: { id: string }) {
  const { t } = useTranslation('planner')
  return (
    <MenuItem onClick={() => openAlbum(id)}>
      <Layers />
      {t('openAlbum')}
    </MenuItem>
  )
}

function ActionItems({
  leave,
  ...rows
}: ActionRowsProps & { leave: (action: () => void) => void }) {
  return useActionRows(rows).map(({ key, Icon, text, leavesCell, run }) => (
    <MenuItem key={key} onClick={leavesCell ? () => leave(run) : run}>
      <Icon />
      {text}
    </MenuItem>
  ))
}

function EditItems({
  id,
  album,
  context,
  earlier,
  later,
  leave
}: {
  id: string
  album: boolean
  context: ActionContext
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
      <ActionItems surface="menuEdit" context={context} leave={leave} />
    </>
  )
}

function OpenMenu({ id, cell }: { id: string; cell: HTMLElement }) {
  const returnTo = useRef<HTMLElement | null>(cell)
  const { board } = plannerStore.getState()
  const context = boardCellContext(board, id, mayPost(useConnection()))
  const album = board.albums?.[id] !== undefined
  const earlier = neighbour(board, id, -1)
  const later = neighbour(board, id, 1)
  const leave = (action: () => void) => {
    returnTo.current = neighbourOf(cell)
    action()
  }
  return (
    <Menu open onOpenChange={(open) => !open && closeCellMenu()}>
      <MenuPopup anchor={cell} sideOffset={OVERLAP} finalFocus={returnTo}>
        <ActionItems surface="menuOpen" context={context} leave={leave} />
        {album && <AlbumItem id={id} />}
        <ActionItems surface="menuPost" context={context} leave={leave} />
        {!context.locked && (
          <EditItems
            id={id}
            album={album}
            context={context}
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
