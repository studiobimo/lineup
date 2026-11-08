import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { BoardGate } from './board-gate'
import { askForFolder, leaveFolder, useFolder } from './folder-board'
import { openBoard } from './open-board'
import { useFolderAction } from './use-folder-action'

export function FolderGate() {
  const { t } = useTranslation('settings')
  const folder = useFolder()
  const { busy, run } = useFolderAction()
  if (folder.status === 'none' || folder.status === 'open') return null
  const { name, status } = folder
  return (
    <BoardGate
      title={t(`folderGate.${status}.title`, { name })}
      description={t(`folderGate.${status}.description`, { name })}
    >
      <Button
        disabled={busy}
        onClick={() => void run(status === 'needs-permission' ? askForFolder : openBoard)}
      >
        {t(status === 'needs-permission' ? 'folderAllow' : 'folderRetry')}
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => void run(leaveFolder)}>
        {t('folderLeaveForBrowser')}
      </Button>
    </BoardGate>
  )
}
