import { useForm, useStore } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { outOfOrder } from '@/features/planner/board'
import { instagram } from '@/features/planner/network-profile'
import { plannerStore } from '@/features/planner/planner'

import { CaptionField, TimeField } from './post-fields'
import { fromFieldTime } from './post-time'

const postFormSchema = z.object({
  caption: z.string().max(instagram.captionLimit),
  when: z.string().refine((time) => Date.parse(time) > Date.now())
})
const fields = [
  ['caption', CaptionField],
  ['when', TimeField]
] as const

export type PostFormValues = z.infer<typeof postFormSchema>

interface PostFormProps {
  cell: string
  initial: PostFormValues
  submitLabel: string
  pending: boolean
  problem?: string
  children?: ReactNode
  actions?: ReactNode
  onSubmit: (values: PostFormValues) => Promise<unknown>
}

export function PostForm({
  cell,
  initial,
  submitLabel,
  pending,
  problem,
  children,
  actions,
  onSubmit
}: PostFormProps) {
  const { t } = useTranslation('provider')
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: postFormSchema },
    onSubmit: ({ value }) => onSubmit(value).catch(() => undefined)
  })
  const when = useStore(form.store, ({ values }) => values.when)
  const valid = !Number.isNaN(Date.parse(when))
  const misordered = valid && outOfOrder(plannerStore.getState().board, cell, fromFieldTime(when))

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      {fields.map(([name, Input]) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <Input
              value={field.state.value}
              invalid={field.state.meta.errors.length > 0}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      ))}
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
      <div className="flex flex-wrap justify-end gap-2">
        {actions}
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
