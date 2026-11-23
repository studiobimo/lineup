import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { lastingToast } from '@/lib/lasting-toast'

import { isStorageFull } from './import-store'

type Failure = string | ((error: unknown) => string)

const isCancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

const folderFailure = (error: unknown) => (isStorageFull(error) ? 'folderFull' : 'folderFailed')

export function useFolderAction() {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>, failure: Failure = folderFailure) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      if (isCancelled(error)) return
      lastingToast({
        type: 'error',
        title: t(typeof failure === 'string' ? failure : failure(error))
      })
    } finally {
      setBusy(false)
    }
  }

  return { busy, run }
}
