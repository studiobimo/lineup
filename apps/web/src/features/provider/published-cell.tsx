import type { PublishedPost } from 'lineup-contract'
import { Lock } from 'lucide-react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { CellBadge } from '@/features/planner/cell-controls'
import { settle } from '@/features/planner/motion'
import { cellShape } from '@/features/planner/network-profile'
import { dateTimeFormat } from '@/i18n/format'

import { PublishedPicture } from './published-picture'

export function PublishedCell({ post, position }: { post: PublishedPost; position: number }) {
  const { t } = useTranslation('provider')
  const { publishedAt } = post
  const label = publishedAt
    ? t('published.cellOn', {
        date: dateTimeFormat({ dateStyle: 'medium' }).format(new Date(publishedAt))
      })
    : t('published.cell')
  return (
    <m.div
      layout
      layoutDependency={position}
      transition={{ layout: settle }}
      className="relative overflow-hidden bg-muted"
      style={cellShape}
    >
      <PublishedPicture post={post} label={label} />
      <div className="pointer-events-none absolute bottom-1 left-1">
        <CellBadge icon={Lock} />
      </div>
    </m.div>
  )
}
