import { useTranslation } from 'react-i18next'

import { type ActionContext, type ActionSurface, visibleActions } from './cell-actions'

export interface ActionRowsProps {
  surface: ActionSurface
  context: ActionContext
}

export function useActionRows({ surface, context }: ActionRowsProps) {
  const { t } = useTranslation('planner')
  return visibleActions(surface, context).map(({ key, action }) => ({
    key,
    Icon: action.icon(context),
    text: t(action.label(context)),
    leavesCell: action.leavesCell,
    run: () => action.run(context)
  }))
}
