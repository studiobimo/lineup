import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle
} from '@/components/ui/dialog'
import { usePlanner } from '@/features/planner/planner'
import { useDialogPresence } from '@/hooks/use-dialog-presence'

import { hasLiveKey, liveAccount, mayPost, useConnection } from './connection'
import { NewPost } from './new-post'
import { PostDetails } from './post-details'
import { PostThumbnail } from './post-thumbnail'
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
  const scheduling = !post && accountId && mayPost(connection)
  const [headerAction, setHeaderAction] = useState<HTMLElement | null>(null)
  return (
    <Dialog {...dialog}>
      <DialogPopup
        className={scheduling ? 'max-w-4xl' : undefined}
        onKeyDown={(event) => event.preventBaseUIHandler()}
      >
        <DialogHeader className={scheduling ? 'pe-36' : undefined}>
          <DialogTitle>{t(post ? 'post.existingTitle' : 'post.title')}</DialogTitle>
          <DialogDescription>
            {post
              ? t(`post.status.${post.status}`, { time: formatPostTime(post.scheduledFor) })
              : t('post.description', { count: images })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className={scheduling ? undefined : 'grid gap-4 sm:grid-cols-[8rem_1fr]'}>
          {!scheduling && <PostThumbnail cell={cell} className="w-32" />}
          <ProviderQueries>
            {post ? (
              <PostDetails cell={cell} post={post} onDone={close} />
            ) : scheduling ? (
              <NewPost
                cell={cell}
                accountId={accountId}
                headerAction={headerAction}
                onDone={close}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t(whatIsMissing(connection))}</p>
            )}
          </ProviderQueries>
        </DialogPanel>
        {scheduling && (
          <div ref={setHeaderAction} className="absolute end-14 top-4 z-10 max-sm:top-3" />
        )}
      </DialogPopup>
    </Dialog>
  )
}
