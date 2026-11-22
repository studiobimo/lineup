import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ExternalLink } from '@/components/external-link'
import { Button } from '@/components/ui/button'
import { provider } from '@/config/provider'
import type { CellPost } from '@/features/planner/board-schema'
import { plannerStore } from '@/features/planner/planner'

import { providerApi, ProviderRequestError } from './api'
import { mayPost, useConnection } from './connection'
import { ErrorNotice } from './error-notice'
import { PostForm } from './post-form'
import type { PostFormValues } from './post-schema'
import { fromFieldTime, localTimeZone, toFieldTime } from './post-time'
import { useProblemText } from './use-problem-text'
import { useProviderAction } from './use-provider-action'

interface PostProps {
  cell: string
  post: CellPost
  onDone: () => void
}

const NOT_FOUND = 404

const freeCell = (cell: string) => plannerStore.getState().updatePosts({ [cell]: undefined })

function Caption({ caption }: { caption: string }) {
  if (!caption) return null
  return <p className="text-sm wrap-anywhere whitespace-pre-wrap">{caption}</p>
}

function CancelPost({ cell, post, onDone }: PostProps) {
  const { t } = useTranslation('provider')
  const [open, setOpen] = useState(false)
  const free = () => {
    freeCell(cell)
    setOpen(false)
    onDone()
  }
  const cancel = useProviderAction(
    () => providerApi['scheduled-posts'][':id'].$delete({ param: { id: post.id } }),
    {
      onSuccess: free,
      onError: (error) => {
        if (error instanceof ProviderRequestError && error.problem?.status === NOT_FOUND) free()
      }
    }
  )
  return (
    <>
      <Button variant="destructive-outline" onClick={() => setOpen(true)}>
        {t('post.cancel')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('post.cancelTitle')}
        description={t('post.cancelDescription', { provider: provider.name })}
        cancelLabel={t('post.keep')}
        confirmLabel={t('post.cancelConfirm')}
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        error={<ErrorNotice error={cancel.error} className="mx-6 w-auto" />}
      />
    </>
  )
}

function ChangePost({ cell, post, onDone }: PostProps) {
  const { t } = useTranslation('provider')
  const problemText = useProblemText()
  const change = useProviderAction(
    ({ caption, when }: PostFormValues) =>
      providerApi['scheduled-posts'][':id'].$patch({
        param: { id: post.id },
        json: { caption, scheduledFor: fromFieldTime(when), timeZone: localTimeZone() }
      }),
    {
      onSuccess: (fresh) => {
        plannerStore
          .getState()
          .updatePosts({ [cell]: { ...post, ...fresh, failure: fresh.failure } })
        onDone()
      }
    }
  )
  return (
    <div className="flex flex-col gap-3">
      <ErrorNotice text={post.failure} />
      <PostForm
        cell={cell}
        initial={{ caption: post.caption, when: toFieldTime(post.scheduledFor) }}
        submitLabel={t('post.saveChanges')}
        pending={change.isPending}
        problem={problemText(change.error)}
        actions={<CancelPost cell={cell} post={post} onDone={onDone} />}
        onSubmit={change.mutateAsync}
      />
    </div>
  )
}

function FreeCell({ cell, onDone, note }: Pick<PostProps, 'cell' | 'onDone'> & { note: string }) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-muted-foreground">{note}</p>
      <Button
        variant="outline"
        onClick={() => {
          freeCell(cell)
          onDone()
        }}
      >
        {t('post.free')}
      </Button>
    </div>
  )
}

export function PostDetails({ cell, post, onDone }: PostProps) {
  const { t } = useTranslation('provider')
  const canChange = mayPost(useConnection())
  const { caption, status, url } = post
  if (status === 'published') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Caption caption={caption} />
        {url && <ExternalLink href={url}>{t('post.view')}</ExternalLink>}
        <FreeCell cell={cell} onDone={onDone} note={t('post.freePublished')} />
      </div>
    )
  }
  if (!canChange) {
    return (
      <div className="flex flex-col gap-3">
        <Caption caption={caption} />
        <FreeCell
          cell={cell}
          onDone={onDone}
          note={t('post.freeWithoutKey', { provider: provider.name })}
        />
      </div>
    )
  }
  if (status === 'publishing') return <Caption caption={caption} />
  return <ChangePost cell={cell} post={post} onDone={onDone} />
}
