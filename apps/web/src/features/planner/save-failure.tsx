import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'

import { plannerStore, usePlanner } from './planner'

const RETRY_SAVE_MS = 5000

export function SaveFailure() {
  const { t } = useTranslation('planner')
  const failed = usePlanner((state) => state.saveFailed)
  useEffect(() => {
    if (!failed) return
    const retry = setInterval(() => plannerStore.getState().retrySave(), RETRY_SAVE_MS)
    const id = toastManager.add({
      type: 'error',
      title: t('saveFailed'),
      description: t('saveFailedHelp'),
      timeout: 0
    })
    return () => {
      clearInterval(retry)
      toastManager.close(id)
    }
  }, [failed, t])
  return null
}
