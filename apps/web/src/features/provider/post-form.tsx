import { useStore } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { fieldProps, usePostForm } from './use-post-form'
import { isMisordered } from './use-misordered'
import { CaptionField, TimeField } from './post-fields'
import { type PostFormValues } from './post-schema'

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
  const { t } = useTranslation('provider')
  const form = usePostForm(initial, onSubmit)
  const when = useStore(form.store, ({ values }) => values.when)
  const misordered = isMisordered(cell, when)

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
          {(field) => <Input {...fieldProps(field)} />}
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
