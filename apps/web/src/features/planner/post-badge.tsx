import { Check, Clock, LoaderCircle, type LucideIcon, TriangleAlert, X } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { openPost } from '@/features/provider/post-store'
import { dateTimeFormat } from '@/i18n/format'
import { cn } from '@/lib/utils'

import type { CellPost } from './board-schema'
import { CellButton } from './cell-controls'

const icons: Record<CellPost['status'], LucideIcon> = {
  scheduled: Clock,
  publishing: LoaderCircle,
  published: Check,
  failed: TriangleAlert,
  cancelled: X
}

/** What is happening to a cell's post, which is the reason it cannot be moved. Opens the post. */
export const PostBadge = memo(function PostBadge({ id, post }: { id: string; post: CellPost }) {
  const { t } = useTranslation('planner')
  const { status, failure } = post
  const Icon = icons[status]
  const time = dateTimeFormat({
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(post.scheduledFor))
  return (
    <CellButton
      size="xs"
      variant={status === 'failed' ? 'destructive-outline' : 'outline'}
      label={t(`postStatus.${status}`, { time, failure })}
      className="pointer-events-auto gap-1 px-1 whitespace-nowrap tabular-nums"
      onClick={() => openPost(id)}
    >
      <Icon className={cn(status === 'publishing' && 'motion-safe:animate-spin')} />
      {status === 'scheduled' ? time : t(`postStatusShort.${status}`)}
    </CellButton>
  )
})
