import { createFileRoute } from '@tanstack/react-router'

import { PlannerPage } from '@/features/planner/planner-page'
import { loadPlannerStrings } from '@/features/planner/planner-strings'

export const Route = createFileRoute('/')({
  loader: loadPlannerStrings,
  component: PlannerPage
})
