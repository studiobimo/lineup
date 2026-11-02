import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ExternalLink } from '@/components/external-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { provider } from '@/config/provider'
import type { CellPost } from '@/features/planner/board-schema'
import { plannerStore } from '@/features/planner/planner'

import { answer, providerApi, ProviderRequestError } from './api'
import { mayPost, useConnection } from './connection'
import { PostForm, type PostFormValues } from './post-form'
import { fromFieldTime, localTimeZone, toFieldTime } from './post-time'
import { PROVIDER_KEY } from './queries'
import { useProblemText } from './use-problem-text'

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
  const problemText = useProblemText()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const free = () => {
    freeCell(cell)
    void queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY] })
    setOpen(false)
    onDone()
  }
  const cancel = useMutation({
    mutationFn: () =>
      answer(providerApi['scheduled-posts'][':id'].$delete({ param: { id: post.id } })),
    onSuccess: free,
    // Already gone at the provider, and that is what was asked for.
    onError: (error) => {
      if (error instanceof ProviderRequestError && error.problem?.status === NOT_FOUND) free()
    }
  })
  return (
    <>
      <Button variant="destructive-outline" onClick={() => setOpen(true)}>
        {t('post.cancel')}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('post.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('post.cancelDescription', { provider: provider.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancel.error && (
            <Alert variant="error" className="mx-6 w-auto">
              <AlertDescription>{problemText(cancel.error)}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              {t('post.keep')}
            </AlertDialogClose>
            <Button
              variant="destructive"
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {t('post.cancelConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  )
}

function ChangePost({ cell, post, onDone }: PostProps) {
  const { t } = useTranslation('provider')
  const problemText = useProblemText()
  const queryClient = useQueryClient()
  const change = useMutation({
    mutationFn: ({ caption, when }: PostFormValues) =>
      answer(
        providerApi['scheduled-posts'][':id'].$patch({
          param: { id: post.id },
          json: { caption, scheduledFor: fromFieldTime(when), timeZone: localTimeZone() }
        })
      ),
    onSuccess: (fresh) => {
      plannerStore.getState().updatePosts({ [cell]: { ...post, ...fresh, failure: fresh.failure } })
      void queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY] })
      onDone()
    }
  })
  return (
    <div className="flex flex-col gap-3">
      {post.failure && (
        <Alert variant="error">
          <AlertDescription>{post.failure}</AlertDescription>
        </Alert>
      )}
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

/** For a link that cannot be changed from here, so that the cell is never stuck. */
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
