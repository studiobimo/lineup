import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle
} from '@/components/ui/dialog'
import { cellShape } from '@/features/planner/network-profile'
import { usePlanner } from '@/features/planner/planner'
import { CellThumbnail } from '@/features/planner/thumbnail'
import { useDialogPresence } from '@/hooks/use-dialog-presence'

import { hasLiveKey, liveAccount, mayPost, useConnection } from './connection'
import { NewPost } from './new-post'
import { PostDetails } from './post-details'
import { closePost } from './post-store'
import { formatPostTime } from './post-time'
import { ProviderQueries } from './provider-queries'

const whatIsMissing = (connection: ReturnType<typeof useConnection>) => {
  if (!hasLiveKey(connection)) return 'post.noKey'
  return mayPost(connection) ? 'post.noAccount' : 'post.readOnly'
}

export function PostDialog({ cell }: { cell: string }) {
  const { t } = useTranslation('provider')
  const { close, dialog } = useDialogPresence(closePost)
  const images = usePlanner(({ board }) => board.albums?.[cell]?.length ?? 1)
  const post = usePlanner(({ board }) => board.posts?.[cell])
  const connection = useConnection()
  const accountId = liveAccount(connection)
  return (
    <Dialog {...dialog}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t(post ? 'post.existingTitle' : 'post.title')}</DialogTitle>
          <DialogDescription>
            {post
              ? t(`post.status.${post.status}`, { time: formatPostTime(post.scheduledFor) })
              : t('post.description', { count: images })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div className="w-32 overflow-hidden rounded-sm bg-muted" style={cellShape}>
            <CellThumbnail id={cell} label={t('post.picture')} />
          </div>
          <ProviderQueries>
            {post ? (
              <PostDetails cell={cell} post={post} onDone={close} />
            ) : accountId && mayPost(connection) ? (
              <NewPost cell={cell} accountId={accountId} onDone={close} />
            ) : (
              <p className="text-sm text-muted-foreground">{t(whatIsMissing(connection))}</p>
            )}
          </ProviderQueries>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
