import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { BoardGate } from './board-gate'
import { askForFolder, leaveFolder, useFolder } from './folder-board'
import { openBoard } from './open-board'

/** A folder board that cannot open yet. The folder is safe, so nothing here sounds like an error. */
export function FolderGate() {
  const { t } = useTranslation('settings')
  const folder = useFolder()
  if (folder.status === 'none') return null
  const { name } = folder
  const unreachable = folder.status === 'unreachable'
  return (
    <BoardGate
      title={t(unreachable ? 'folderGoneTitle' : 'folderLockedTitle', { name })}
      description={t(unreachable ? 'folderGoneDescription' : 'folderLockedDescription', { name })}
    >
      <Button onClick={() => void (unreachable ? openBoard() : askForFolder())}>
        {t(unreachable ? 'folderRetry' : 'folderAllow')}
      </Button>
      <Button variant="outline" onClick={() => void leaveFolder()}>
        {t('folderLeaveForBrowser')}
      </Button>
    </BoardGate>
  )
}
