import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  chooseFolder,
  countRemovedFiles,
  leaveFolder,
  offerRemovedFiles,
  useFolder
} from '@/features/planner/folder-board'
import { supportsFolders } from '@/features/planner/open-board'
import { useFolderAction } from '@/features/planner/use-folder-action'

/** The offer is a toast, and a toast behind this dialog could not be clicked. */
function RemovedPhotos({ onOffered }: { onOffered: () => void }) {
  const { t } = useTranslation('settings')
  const { busy, run } = useFolderAction()
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Without a count there is nothing to show, and the photos are still in the folder.
    countRemovedFiles().then(setCount, () => undefined)
  }, [])

  if (count === 0) return null
  const offer = async () => {
    await offerRemovedFiles()
    onOffered()
  }
  return (
    <div className="mt-3">
      <p className="text-sm text-muted-foreground">{t('removedFiles', { count })}</p>
      <Button variant="outline" className="mt-2" disabled={busy} onClick={() => void run(offer)}>
        {t('offerRemoved')}
      </Button>
    </div>
  )
}

export function FolderSettings({ onOffered }: { onOffered: () => void }) {
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
          <RemovedPhotos onOffered={onOffered} />
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
