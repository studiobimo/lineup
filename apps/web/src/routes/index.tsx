import { createFileRoute } from '@tanstack/react-router'

import { PlannerPage } from '@/features/planner/planner-page'
import { loadStrings } from '@/i18n/load-strings'

export const Route = createFileRoute('/')({
  loader: () => loadStrings('planner'),
  component: PlannerPage
})
