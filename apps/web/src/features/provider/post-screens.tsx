import { useStore } from '@tanstack/react-form'
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ErrorNotice } from './error-notice'
import { MediaFields } from './media-fields'
import { fieldProps, usePostForm } from './use-post-form'
import { CaptionField, TimeField } from './post-fields'
import { type PostFormValues } from './post-schema'
import { ScheduleWarning } from './schedule-warning'
import { SlideStrip } from './slide-strip'
import { SlideViewer } from './slide-viewer'
import { TagPicker } from './tag-picker'
import type { TagDraft } from './tags'

interface PostScreensProps {
  cell: string
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

interface TaggingScreenProps {
  slides: PostScreensProps['slides']
  index: number
  onIndexChange: (index: number) => void
  tags: TagDraft[]
  heading: RefObject<HTMLHeadingElement | null>
  onChange: (tags: TagDraft[]) => void
  onDone: () => void
}

function TaggingScreen({
  slides,
  index,
  onIndexChange,
  tags,
  heading,
  onChange,
  onDone
}: TaggingScreenProps) {
  const { t } = useTranslation('provider')
  return (
    <>
      <h3 ref={heading} tabIndex={-1} className="text-base font-medium outline-none">
        {t('post.tags.title')}
      </h3>
      <TagPicker
        slides={slides}
        index={index}
        onIndexChange={onIndexChange}
        tags={tags}
        onChange={onChange}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onDone}>
          {t('post.screens.done')}
        </Button>
      </div>
    </>
  )
}

interface MainActionsProps {
  open: RefObject<HTMLButtonElement | null>
  tagCount: number
  onTag: () => void
}

function MainActions({ open, tagCount, onTag }: MainActionsProps) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button ref={open} type="button" variant="secondary" onClick={onTag}>
        {t(tagCount > 0 ? 'post.screens.tagCount' : 'post.screens.tag', { count: tagCount })}
      </Button>
    </div>
  )
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

function useScreenFocus(tagging: boolean) {
  const heading = useRef<HTMLHeadingElement>(null)
  const open = useRef<HTMLButtonElement>(null)
  const moved = useRef(false)
  // Not on first render: the dialog places focus itself then, and the button would take it. ~keep
  useEffect(() => {
    if (!moved.current) moved.current = true
    else if (tagging) heading.current?.focus()
    else open.current?.focus()
  }, [tagging])
  return { heading, open }
}

function useMainScreenOnProblem(problem: string | undefined, onProblem: () => void) {
  // A refusal from the server, such as a time already past, shows on the main screen. ~keep
  const [seen, setSeen] = useState(problem)
  if (problem !== seen) {
    setSeen(problem)
    if (problem) onProblem()
  }
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
  form: ReturnType<typeof usePostForm>
  tags: TagDraft[]
  problem?: string
  children?: ReactNode
}

function MainFields({ cell, form, tags, problem, children }: MainFieldsProps) {
  const when = useStore(form.store, ({ values }) => values.when)
  return (
    <>
      <form.Field name="caption">{(field) => <CaptionField {...fieldProps(field)} />}</form.Field>
      <form.Field name="when">
        {(field) => <TimeField cell={cell} {...fieldProps(field)} />}
      </form.Field>
      <TaggedNote tags={tags} />
      <ScheduleWarning cell={cell} when={when} onUse={(time) => form.setFieldValue('when', time)} />
      {children}
      <ErrorNotice text={problem} />
    </>
  )
}

export function PostScreens({
  cell,
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
  const [tagging, setTagging] = useState(false)
  const [slide, setSlide] = useState(0)
  const { heading, open } = useScreenFocus(tagging)
  const form = usePostForm(initial, onSubmit)
  const formId = useId()

  useMainScreenOnProblem(problem, () => setTagging(false))

  return (
    <form
      id={formId}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (tagging) setTagging(false)
        else void form.handleSubmit()
      }}
    >
      {tagging ? (
        <TaggingScreen
          slides={slides}
          index={slide}
          onIndexChange={setSlide}
          tags={tags}
          heading={heading}
          onChange={onTagsChange}
          onDone={() => setTagging(false)}
        />
      ) : (
        <>
          <SubmitAction target={headerAction} form={formId} label={submitLabel} pending={pending} />
          <MediaFields
            media={
              <div className="flex flex-col gap-2">
                <SlideViewer slides={slides} index={slide} onIndexChange={setSlide} />
                <SlideStrip cell={cell} slides={slides} index={slide} onIndexChange={setSlide} />
              </div>
            }
          >
            <MainFields cell={cell} form={form} tags={tags} problem={problem}>
              {children}
            </MainFields>
          </MediaFields>
          <MainActions open={open} tagCount={tags.length} onTag={() => setTagging(true)} />
        </>
      )}
    </form>
  )
}
