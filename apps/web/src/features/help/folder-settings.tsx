import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { chooseFolder, leaveFolder, useFolder } from '@/features/planner/folder-board'
import { supportsFolders } from '@/features/planner/open-board'
import { useFolderAction } from '@/features/planner/use-folder-action'

export function FolderSettings() {
  const { t } = useTranslation('settings')
  const folder = useFolder()
  const { busy, run } = useFolderAction()
  if (!supportsFolders()) return null

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
