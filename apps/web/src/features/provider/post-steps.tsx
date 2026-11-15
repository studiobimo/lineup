import { useForm, useStore } from '@tanstack/react-form'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { isMisordered } from './use-misordered'
import { CaptionField, TimeField } from './post-fields'
import { postFormSchema, type PostFormValues } from './post-schema'
import { PostThumbnail } from './post-thumbnail'
import { TagPicker } from './tag-picker'
import type { TagDraft } from './tags'

const STEPS = ['caption', 'tags', 'when'] as const
const LAST = STEPS.length - 1

interface PostStepsProps {
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

export function PostSteps({
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
}: PostStepsProps) {
  const { t } = useTranslation('provider')
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: postFormSchema },
    onSubmit: ({ value }) => onSubmit(value).catch(() => undefined)
  })
  const { caption, when } = useStore(form.store, ({ values }) => values)
  const captionFits = postFormSchema.shape.caption.safeParse(caption).success
  const misordered = isMisordered(cell, when)

  // A refusal from the server, such as a time already past, is about what step 3 holds. ~keep
  const [seen, setSeen] = useState(problem)
  if (problem !== seen) {
    setSeen(problem)
    if (problem) setStep(LAST)
  }

  // Not on first render: the dialog places focus itself then, and a heading would take it. ~keep
  useEffect(() => {
    if (moved.current) heading.current?.focus()
    moved.current = true
  }, [step])

  const name = STEPS[step]
  const usernames = tags.map(({ username }) => `@${username}`).join(', ')

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (step === LAST) void form.handleSubmit()
        else if (captionFits) setStep(step + 1)
      }}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {t('post.steps.indicator', { current: step + 1, count: STEPS.length })}
        </p>
        <h3 ref={heading} tabIndex={-1} className="text-base font-medium outline-none">
          {t(`post.steps.names.${name}`)}
        </h3>
      </div>
      {name === 'caption' && (
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <PostThumbnail cell={cell} className="w-32" />
          <form.Field name="caption">
            {(field) => (
              <CaptionField
                value={field.state.value}
                invalid={field.state.meta.errors.length > 0}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
        </div>
      )}
      {name === 'tags' && <TagPicker slides={slides} tags={tags} onChange={onTagsChange} />}
      {name === 'when' && (
        <>
          <div className="flex items-start gap-3 rounded-sm bg-muted/50 p-2">
            <PostThumbnail cell={cell} className="w-12 shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <p className="line-clamp-2 wrap-anywhere whitespace-pre-wrap">
                {caption || (
                  <span className="text-muted-foreground">{t('post.steps.noCaption')}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground wrap-anywhere">
                {tags.length > 0
                  ? t('post.steps.tagged', { count: tags.length, usernames })
                  : t('post.steps.noTags')}
              </p>
            </div>
          </div>
          <form.Field name="when">
            {(field) => (
              <TimeField
                value={field.state.value}
                invalid={field.state.meta.errors.length > 0}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>
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
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {step > 0 && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setStep(step - 1)}
          >
            {t('post.steps.back')}
          </Button>
        )}
        {/* Keyed apart: one button node turning into the submit would take the click that moved here. ~keep */}
        {step < LAST ? (
          <Button
            key="next"
            type="button"
            disabled={!captionFits}
            onClick={() => setStep(step + 1)}
          >
            {t(name === 'tags' && tags.length === 0 ? 'post.steps.skip' : 'post.steps.next')}
          </Button>
        ) : (
          <Button key="submit" type="submit" loading={pending}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}
