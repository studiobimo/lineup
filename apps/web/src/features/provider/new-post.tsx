import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'
import { provider } from '@/config/provider'
import { plannerStore, usePlanner } from '@/features/planner/planner'

import { NO_OPTIONS, sentOptions } from './post-options'
import { PostSections } from './post-sections'
import { type PostFormValues } from './post-schema'
import { PostScreens } from './post-screens'
import {
  formatPostTime,
  fromFieldTime,
  localTimeZone,
  nextFreeHour,
  toFieldTime
} from './post-time'
import { PROVIDER_KEY } from './queries'
import { toUserTags, type TagDraft } from './tags'
import { sendPost } from './send-post'
import { useDefaultTime } from './use-spacing'
import { useSendProblem } from './use-send-problem'

interface NewPostProps {
  cell: string
  accountId: string
  headerAction: HTMLElement | null
  onDone: () => void
}

export function NewPost({ cell, accountId, headerAction, onDone }: NewPostProps) {
  const { t } = useTranslation('provider')
  const album = usePlanner(({ board }) => board.albums?.[cell])
  const images = useMemo(() => album ?? [cell], [album, cell])
  const [sending, setSending] = useState(0)
  const [tags, setTags] = useState<TagDraft[]>([])
  const [options, setOptions] = useState(NO_OPTIONS)
  const records = usePlanner(({ images: known }) => known)
  const slides = images.map((id) => ({ id, video: Boolean(records[id]?.video) }))
  const queryClient = useQueryClient()
  const [from] = useState(() => nextFreeHour().getTime())
  const start = useDefaultTime(cell, from)

  const send = useMutation({
    mutationFn: async ({ caption, when }: PostFormValues) => {
      const scheduledFor = fromFieldTime(when)
      const userTags = toUserTags(tags)
      const post = {
        accountId,
        caption,
        scheduledFor,
        timeZone: localTimeZone(),
        ...(userTags.length > 0 && { userTags }),
        ...sentOptions(options, slides)
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

  const problem = useSendProblem(send.error)

  return (
    <PostScreens
      cell={cell}
      slides={slides}
      tags={tags}
      onTagsChange={setTags}
      initial={{ caption: '', when: toFieldTime(start) }}
      submitLabel={
        sending > 0
          ? t('post.sending', { position: sending, count: images.length })
          : t('post.schedule')
      }
      pending={send.isPending}
      headerAction={headerAction}
      problem={problem}
      onSubmit={send.mutateAsync}
    >
      <PostSections slides={slides} options={options} onChange={setOptions} />
      <p className="text-sm text-muted-foreground">
        {t('post.notice', { provider: provider.name })}
      </p>
    </PostScreens>
  )
}
