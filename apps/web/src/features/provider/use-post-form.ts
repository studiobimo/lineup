import { useForm } from '@tanstack/react-form'

import type { FieldProps } from './post-fields'
import { postFormSchema, type PostFormValues } from './post-schema'

interface FormFieldLike {
  state: { value: string; meta: { errors: unknown[] } }
  handleBlur: () => void
  handleChange: (value: string) => void
}

export const fieldProps = (field: FormFieldLike): FieldProps => ({
  value: field.state.value,
  invalid: field.state.meta.errors.length > 0,
  onBlur: field.handleBlur,
  onChange: field.handleChange
})

// A failed send is shown by the caller from the mutation, so it is not rethrown here. ~keep
export const usePostForm = (
  initial: PostFormValues,
  onSubmit: (values: PostFormValues) => Promise<unknown>
) =>
  useForm({
    defaultValues: initial,
    validators: { onSubmit: postFormSchema },
    onSubmit: ({ value }) => onSubmit(value).catch(() => undefined)
  })
