import { createFileRoute } from '@tanstack/react-router'

import { TypeSpecimen } from '@/components/type-specimen'

export const Route = createFileRoute('/')({
  component: TypeSpecimen
})
