import { createFileRoute } from '@tanstack/react-router'

import { PlannerPage } from '@/features/planner/planner-page'

export const Route = createFileRoute('/')({
  component: PlannerPage
})
