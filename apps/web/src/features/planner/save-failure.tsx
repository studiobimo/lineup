import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { toastManager } from '@/components/ui/toast'

import { plannerStore, usePlanner } from './planner'

// Often enough to catch a drive coming back, and rarely enough that nothing notices.
const RETRY_SAVE_MS = 5000

/** Stays up until a save goes through, because this is not something to miss. */
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
