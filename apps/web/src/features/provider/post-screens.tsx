import { useStore } from '@tanstack/react-form'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ErrorNotice } from './error-notice'
import { MediaFields } from './media-fields'
import { fieldProps, usePostForm } from './use-post-form'
import { CaptionField, TimeField } from './post-fields'
import { type PostFormValues } from './post-schema'
import { ScheduleWarning } from './schedule-warning'
import { PostThumbnail } from './post-thumbnail'
import { TagPicker } from './tag-picker'
import type { TagDraft } from './tags'

interface PostScreensProps {
  cell: string
  initial: PostFormValues
  slides: { id: string; video: boolean }[]
  tags: TagDraft[]
  submitLabel: string
  pending: boolean
  problem?: string
  children?: ReactNode
  onTagsChange: (tags: TagDraft[]) => void
  onSubmit: (values: PostFormValues) => Promise<unknown>
}

interface TaggingScreenProps {
  slides: PostScreensProps['slides']
  tags: TagDraft[]
  heading: RefObject<HTMLHeadingElement | null>
  onChange: (tags: TagDraft[]) => void
  onDone: () => void
}

function TaggingScreen({ slides, tags, heading, onChange, onDone }: TaggingScreenProps) {
  const { t } = useTranslation('provider')
  return (
    <>
      <h3 ref={heading} tabIndex={-1} className="text-base font-medium outline-none">
        {t('post.tags.title')}
      </h3>
      <TagPicker slides={slides} tags={tags} onChange={onChange} />
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
  submitLabel: string
  pending: boolean
  onTag: () => void
}

function MainActions({ open, tagCount, submitLabel, pending, onTag }: MainActionsProps) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button ref={open} type="button" variant="secondary" onClick={onTag}>
        {t(tagCount > 0 ? 'post.screens.tagCount' : 'post.screens.tag', { count: tagCount })}
      </Button>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </div>
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

export function PostScreens({
  cell,
  initial,
  slides,
  tags,
  submitLabel,
  pending,
  problem,
  children,
  onTagsChange,
  onSubmit
}: PostScreensProps) {
  const { t } = useTranslation('provider')
  const [tagging, setTagging] = useState(false)
  const { heading, open } = useScreenFocus(tagging)
  const form = usePostForm(initial, onSubmit)
  const when = useStore(form.store, ({ values }) => values.when)

  // A refusal from the server, such as a time already past, shows on the main screen. ~keep
  const [seen, setSeen] = useState(problem)
  if (problem !== seen) {
    setSeen(problem)
    if (problem) setTagging(false)
  }

  const usernames = tags.map(({ username }) => `@${username}`).join(', ')

  return (
    <form
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
          tags={tags}
          heading={heading}
          onChange={onTagsChange}
          onDone={() => setTagging(false)}
        />
      ) : (
        <>
          <MediaFields media={<PostThumbnail cell={cell} className="w-full" />}>
            <form.Field name="caption">
              {(field) => <CaptionField {...fieldProps(field)} />}
            </form.Field>
            <form.Field name="when">
              {(field) => <TimeField cell={cell} {...fieldProps(field)} />}
            </form.Field>
            {tags.length > 0 && (
              <p className="text-xs text-muted-foreground wrap-anywhere">
                {t('post.screens.tagged', { count: tags.length, usernames })}
              </p>
            )}
            <ScheduleWarning
              cell={cell}
              when={when}
              onUse={(time) => form.setFieldValue('when', time)}
            />
            {children}
            <ErrorNotice text={problem} />
          </MediaFields>
          <MainActions
            open={open}
            tagCount={tags.length}
            submitLabel={submitLabel}
            pending={pending}
            onTag={() => setTagging(true)}
          />
        </>
      )}
    </form>
  )
}
