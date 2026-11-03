import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { lastingToast } from '@/lib/lasting-toast'

import { isStorageFull } from './import-store'

const isCancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

/** Everything a person does to a folder can fail, and closing the picker is not a failure. */
export function useFolderAction() {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      if (isCancelled(error)) return
      lastingToast({
        type: 'error',
        title: t(isStorageFull(error) ? 'folderFull' : 'folderFailed')
      })
    } finally {
      setBusy(false)
    }
  }

  return { busy, run }
}
