import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { CellPost } from './board-schema'

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

/** What is happening to a cell's post, which is the reason it cannot be moved. */
export function PostBadge({ post }: { post: CellPost }) {
  const { t } = useTranslation('planner')
  const time = timeFormat.format(new Date(post.scheduledFor))
  return (
    <span className="flex items-center gap-1 rounded-sm bg-background px-1 py-0.5 text-xs/4 whitespace-nowrap text-foreground tabular-nums shadow-xs">
      <Clock aria-hidden className="size-3" />
      <span className="sr-only">{t('postScheduled')}</span>
      {time}
    </span>
  )
}
