import { ArrowRightLeft, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { Container } from './board'
import { instagram } from './network-profile'
import { plannerStore } from './planner'
import { useNearViewport } from './use-near-viewport'
import { useThumbnail } from './use-thumbnail'

const { width, height } = instagram.cellRatio

interface BoardCellProps {
  id: string
  container: Container
  position: number
}

function Thumbnail({ id, label }: { id: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useThumbnail(canvas, id)
  return <canvas ref={canvas} role="img" aria-label={label} className="size-full object-cover" />
}

export function BoardCell({ id, container, position }: BoardCellProps) {
  const { t } = useTranslation('planner')
  const cell = useRef<HTMLDivElement>(null)
  const near = useNearViewport(cell)
  const toTray = container === 'grid'

  return (
    <div
      ref={cell}
      className="group relative overflow-hidden bg-muted"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {near && <Thumbnail id={id} label={t('cell', { position })} />}
      <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={t(toTray ? 'moveToTray' : 'moveToGrid')}
          onClick={() => plannerStore.getState().move(id, toTray ? 'tray' : 'grid')}
        >
          <ArrowRightLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          aria-label={t('remove')}
          onClick={() => plannerStore.getState().remove([id])}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}
