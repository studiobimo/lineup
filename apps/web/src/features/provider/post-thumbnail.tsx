import { useTranslation } from 'react-i18next'

import { cellShape } from '@/features/planner/network-profile'
import { CellThumbnail } from '@/features/planner/thumbnail'
import { cn } from '@/lib/utils'

export function PostThumbnail({ cell, className }: { cell: string; className?: string }) {
  const { t } = useTranslation('provider')
  return (
    <div className={cn('overflow-hidden rounded-sm bg-muted', className)} style={cellShape}>
      <CellThumbnail id={cell} label={t('post.picture')} />
    </div>
  )
}
