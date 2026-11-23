import type { PublishedPost } from 'lineup-contract'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cellShape } from '@/features/planner/network-profile'

import {
  dismissNotices,
  noticeKey,
  type OrderNotice,
  type Timed,
  useOrderNotices
} from './order-notice'
import { formatPostTime } from './post-time'
import { PublishedPicture } from './published-picture'

function Swapped({ post, found }: { post: Timed; found?: PublishedPost }) {
  const { t } = useTranslation('provider')
  return (
    <figure className="flex w-24 flex-col gap-1.5 text-xs text-muted-foreground">
      <div className="overflow-hidden rounded-sm bg-muted" style={cellShape}>
        <PublishedPicture post={found ?? { id: post.id }} label={t('swapped.picture')} />
      </div>
      <figcaption>
        <p>{t('swapped.scheduled', { time: formatPostTime(post.scheduledFor) })}</p>
        <p className="text-foreground">
          {t('swapped.live', { time: formatPostTime(post.publishedAt) })}
        </p>
      </figcaption>
    </figure>
  )
}

function Swap({ swap, posts }: { swap: OrderNotice; posts: PublishedPost[] }) {
  const find = ({ id }: Timed) => posts.find((post) => post.id === id)
  return (
    <li className="flex gap-4">
      <Swapped post={swap.first} found={find(swap.first)} />
      <Swapped post={swap.second} found={find(swap.second)} />
    </li>
  )
}

// ~keep
// Shown at once when a swap is seen while the app is open, and on opening when one was seen
// while it was closed. Closing it in any way marks those posts as told, so it does not return.
export function OrderNoticeDialog({ posts }: { posts: PublishedPost[] }) {
  const { t } = useTranslation('provider')
  const notices = useOrderNotices()
  return (
    <AlertDialog open={notices.length > 0} onOpenChange={(open) => open || dismissNotices()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('swapped.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('swapped.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex max-h-72 flex-col gap-4 overflow-y-auto px-6 pb-4">
          {notices.map((swap) => (
            <Swap key={noticeKey(swap)} swap={swap} posts={posts} />
          ))}
        </ul>
        <p className="px-6 pb-4 text-sm text-muted-foreground">{t('swapped.tip')}</p>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button />}>{t('swapped.dismiss')}</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
