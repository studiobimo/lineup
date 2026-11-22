import { useStore } from '@tanstack/react-form'
import type { ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { fieldProps, usePostForm } from './use-post-form'
import { CaptionField, TimeField } from './post-fields'
import { type PostFormValues } from './post-schema'
import { ScheduleWarning } from './schedule-warning'

const fields = [
  ['caption', CaptionField],
  ['when', TimeField]
] as const

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
  const form = usePostForm(initial, onSubmit)
  const when = useStore(form.store, ({ values }) => values.when)

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
          {(field) => <Input cell={cell} {...fieldProps(field)} />}
        </form.Field>
      ))}
      <ScheduleWarning cell={cell} when={when} onUse={(time) => form.setFieldValue('when', time)} />
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
