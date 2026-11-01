import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { toastManager } from '@/components/ui/toast'
import { chooseFolder, leaveFolder, useFolder } from '@/features/planner/folder-board'
import { supportsFolders } from '@/features/planner/open-board'

const isCancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export function FolderSettings() {
  const { t } = useTranslation('settings')
  const folder = useFolder()
  const [busy, setBusy] = useState(false)
  if (!supportsFolders()) return null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      if (!isCancelled(error)) toastManager.add({ type: 'error', title: t('folderFailed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      {folder.status === 'open' ? (
        <>
          <p className="text-sm">{t('folderInUse', { name: folder.name })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('folderInUseNote')}</p>
          <Button
            variant="outline"
            className="mt-2"
            disabled={busy}
            onClick={() => void run(leaveFolder)}
          >
            {t('folderLeave')}
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" disabled={busy} onClick={() => void run(chooseFolder)}>
            {t(busy ? 'folderChoosing' : 'folderChoose')}
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">{t('folderNote')}</p>
        </>
      )}
    </div>
  )
}
