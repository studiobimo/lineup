import { useStore } from '@tanstack/react-form'
import { type ReactNode, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ErrorNotice } from './error-notice'
import { MediaFields } from './media-fields'
import { fieldProps, usePostForm } from './use-post-form'
import { CaptionField, TimeField } from './post-fields'
import { type PostFormValues } from './post-schema'
import { MakeRoom } from './make-room'
import { ScheduleWarning } from './schedule-warning'
import { SlideStrip } from './slide-strip'
import { SlideViewer } from './slide-viewer'
import type { TagDraft } from './tags'

interface PostScreensProps {
  cell: string
  from: number
  initial: PostFormValues
  slides: { id: string; video: boolean }[]
  tags: TagDraft[]
  submitLabel: string
  pending: boolean
  headerAction: HTMLElement | null
  problem?: string
  children?: ReactNode
  onTagsChange: (tags: TagDraft[]) => void
  onSubmit: (values: PostFormValues) => Promise<unknown>
}

interface SubmitActionProps {
  target: HTMLElement | null
  form: string
  label: string
  pending: boolean
}

function SubmitAction({ target, form, label, pending }: SubmitActionProps) {
  if (!target) return null
  return createPortal(
    <Button type="submit" form={form} loading={pending}>
      {label}
    </Button>,
    target
  )
}

function TaggedNote({ tags }: { tags: TagDraft[] }) {
  const { t } = useTranslation('provider')
  if (tags.length === 0) return null
  const usernames = tags.map(({ username }) => `@${username}`).join(', ')
  return (
    <p className="text-xs text-muted-foreground wrap-anywhere">
      {t('post.screens.tagged', { count: tags.length, usernames })}
    </p>
  )
}

interface MainFieldsProps {
  cell: string
  from: number
  form: ReturnType<typeof usePostForm>
  tags: TagDraft[]
  problem?: string
  children?: ReactNode
}

function MainFields({ cell, from, form, tags, problem, children }: MainFieldsProps) {
  const when = useStore(form.store, ({ values }) => values.when)
  return (
    <>
      <form.Field name="caption">{(field) => <CaptionField {...fieldProps(field)} />}</form.Field>
      <form.Field name="when">
        {(field) => <TimeField cell={cell} {...fieldProps(field)} />}
      </form.Field>
      <TaggedNote tags={tags} />
      <MakeRoom cell={cell} from={from} onUse={(time) => form.setFieldValue('when', time)} />
      <ScheduleWarning cell={cell} when={when} onUse={(time) => form.setFieldValue('when', time)} />
      {children}
      <ErrorNotice text={problem} />
    </>
  )
}

export function PostScreens({
  cell,
  from,
  initial,
  slides,
  tags,
  submitLabel,
  pending,
  headerAction,
  problem,
  children,
  onTagsChange,
  onSubmit
}: PostScreensProps) {
  const [slide, setSlide] = useState(0)
  const form = usePostForm(initial, onSubmit)
  const formId = useId()

  return (
    <form
      id={formId}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <SubmitAction target={headerAction} form={formId} label={submitLabel} pending={pending} />
      <MediaFields
        media={
          <div className="flex flex-col gap-2">
            <SlideViewer
              slides={slides}
              index={slide}
              onIndexChange={setSlide}
              tagging={{ tags, onChange: onTagsChange }}
            />
            <SlideStrip cell={cell} slides={slides} index={slide} onIndexChange={setSlide} />
          </div>
        }
      >
        <MainFields cell={cell} from={from} form={form} tags={tags} problem={problem}>
          {children}
        </MainFields>
      </MediaFields>
    </form>
  )
}
