import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'
import { provider } from '@/config/provider'
import { instagram } from '@/features/planner/network-profile'
import { plannerStore, usePlanner } from '@/features/planner/planner'

import { AltTextSection } from './alt-text-section'
import { CollaboratorsSection } from './collaborators-section'
import { NO_OPTIONS, toAltTexts } from './post-options'
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
import { MissingCopyError, sendPost, VideoLimitError } from './send-post'
import { useDefaultTime } from './use-spacing'
import { useProblemText } from './use-problem-text'

interface NewPostProps {
  cell: string
  accountId: string
  headerAction: HTMLElement | null
  onDone: () => void
}

export function NewPost({ cell, accountId, headerAction, onDone }: NewPostProps) {
  const { t } = useTranslation('provider')
  const problemText = useProblemText()
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
      const altTexts = toAltTexts(options.altTexts, slides)
      const post = {
        accountId,
        caption,
        scheduledFor,
        timeZone: localTimeZone(),
        ...(userTags.length > 0 && { userTags }),
        ...(altTexts && { altTexts }),
        ...(options.collaborators.length > 0 && { collaborators: options.collaborators })
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
      : error instanceof VideoLimitError
        ? t(`post.videoLimit.${error.limit}`, {
            size: instagram.videoSizeLimit / 1024 / 1024,
            minutes: instagram.reelLengthLimit / 60,
            count: instagram.videosPerPost
          })
        : problemText(error)

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
      <AltTextSection
        slides={slides}
        altTexts={options.altTexts}
        onChange={(altTexts) => setOptions({ ...options, altTexts })}
      />
      <CollaboratorsSection
        collaborators={options.collaborators}
        onChange={(collaborators) => setOptions({ ...options, collaborators })}
      />
      <p className="text-sm text-muted-foreground">
        {t('post.notice', { provider: provider.name })}
      </p>
    </PostScreens>
  )
}
