import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'
import { provider } from '@/config/provider'
import { imagesOf } from '@/features/planner/board'
import { instagram } from '@/features/planner/network-profile'
import { plannerStore, usePlanner } from '@/features/planner/planner'

import { PostForm, type PostFormValues } from './post-form'
import {
  formatPostTime,
  fromFieldTime,
  localTimeZone,
  nextFreeHour,
  toFieldTime
} from './post-time'
import { PROVIDER_KEY } from './queries'
import { TagPicker } from './tag-picker'
import { allNamed, InvalidTagError, toUserTags, type TagDraft } from './tags'
import { MissingCopyError, sendPost, VideoLimitError } from './send-post'
import { useProblemText } from './use-problem-text'

interface NewPostProps {
  cell: string
  accountId: string
  onDone: () => void
}

export function NewPost({ cell, accountId, onDone }: NewPostProps) {
  const { t } = useTranslation('provider')
  const problemText = useProblemText()
  const images = imagesOf(plannerStore.getState().board, cell)
  const [sending, setSending] = useState(0)
  const [tags, setTags] = useState<TagDraft[]>([])
  const records = usePlanner(({ images: known }) => known)
  const slides = images.map((id) => ({ id, video: Boolean(records[id]?.video) }))
  const queryClient = useQueryClient()

  const send = useMutation({
    mutationFn: async ({ caption, when }: PostFormValues) => {
      if (!allNamed(tags)) throw new InvalidTagError()
      const scheduledFor = fromFieldTime(when)
      const userTags = toUserTags(tags)
      const post = {
        accountId,
        caption,
        scheduledFor,
        timeZone: localTimeZone(),
        ...(userTags.length > 0 && { userTags })
      }
      return sendPost({ cell, images, post, onImage: setSending })
    },
    onSuccess: (post) => {
      plannerStore.getState().linkPost(cell, post)
      void queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY] })
      const time = formatPostTime(post.scheduledFor)
      toastManager.add({ type: 'success', title: t('post.scheduled', { time }) })
      onDone()
    },
    onSettled: () => setSending(0)
  })

  const { error } = send
  const problem =
    error instanceof MissingCopyError
      ? t('post.missingCopy')
      : error instanceof InvalidTagError
        ? t('post.tags.invalid')
        : error instanceof VideoLimitError
          ? t(`post.videoLimit.${error.limit}`, {
              size: instagram.videoSizeLimit / 1024 / 1024,
              minutes: instagram.reelLengthLimit / 60,
              count: instagram.videosPerPost
            })
          : problemText(error)

  return (
    <PostForm
      cell={cell}
      initial={{ caption: '', when: toFieldTime(nextFreeHour()) }}
      submitLabel={
        sending > 0
          ? t('post.sending', { position: sending, count: images.length })
          : t('post.schedule')
      }
      pending={send.isPending}
      problem={problem}
      onSubmit={send.mutateAsync}
    >
      <TagPicker slides={slides} tags={tags} onChange={setTags} />
      <p className="text-sm text-muted-foreground">
        {t('post.notice', { provider: provider.name })}
      </p>
    </PostForm>
  )
}
