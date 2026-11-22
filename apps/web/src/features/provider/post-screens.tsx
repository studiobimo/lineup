import { useStore } from '@tanstack/react-form'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { MediaFields } from './media-fields'
import { fieldProps, usePostForm } from './use-post-form'
import { isMisordered } from './use-misordered'
import { CaptionField, TimeField } from './post-fields'
import { type PostFormValues } from './post-schema'
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
  const heading = useRef<HTMLHeadingElement>(null)
  const open = useRef<HTMLButtonElement>(null)
  const moved = useRef(false)
  const form = usePostForm(initial, onSubmit)
  const when = useStore(form.store, ({ values }) => values.when)
  const misordered = isMisordered(cell, when)

  // A refusal from the server, such as a time already past, shows on the main screen. ~keep
  const [seen, setSeen] = useState(problem)
  if (problem !== seen) {
    setSeen(problem)
    if (problem) setTagging(false)
  }

  // Not on first render: the dialog places focus itself then, and the button would take it. ~keep
  useEffect(() => {
    if (!moved.current) moved.current = true
    else if (tagging) heading.current?.focus()
    else open.current?.focus()
  }, [tagging])

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
        <>
          <h3 ref={heading} tabIndex={-1} className="text-base font-medium outline-none">
            {t('post.tags.title')}
          </h3>
          <TagPicker slides={slides} tags={tags} onChange={onTagsChange} />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setTagging(false)}>
              {t('post.screens.done')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <MediaFields media={<PostThumbnail cell={cell} className="w-full" />}>
            <form.Field name="caption">
              {(field) => <CaptionField {...fieldProps(field)} />}
            </form.Field>
            <form.Field name="when">{(field) => <TimeField {...fieldProps(field)} />}</form.Field>
            {tags.length > 0 && (
              <p className="text-xs text-muted-foreground wrap-anywhere">
                {t('post.screens.tagged', { count: tags.length, usernames })}
              </p>
            )}
            {misordered && (
              <Alert variant="warning">
                <AlertDescription>{t('post.outOfOrder')}</AlertDescription>
              </Alert>
            )}
            {children}
            {problem && (
              <Alert variant="error">
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            )}
          </MediaFields>
          <div className="flex flex-wrap justify-end gap-2">
            <Button ref={open} type="button" variant="secondary" onClick={() => setTagging(true)}>
              {t(tags.length > 0 ? 'post.screens.tagCount' : 'post.screens.tag', {
                count: tags.length
              })}
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
