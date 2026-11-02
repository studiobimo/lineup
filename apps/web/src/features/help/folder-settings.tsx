import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

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

import { DialogSection } from './dialog-sections'

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
    <DialogSection title={t('removedTitle')} description={t('removedFiles', { count })}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void run(offer)}>
          {t('offerRemoved')}
        </Button>
      </div>
    </DialogSection>
  )
}

export function FolderSettings({ onOffered }: { onOffered: () => void }) {
  const { t } = useTranslation('settings')
  const folder = useFolder()
  const { busy, run } = useFolderAction()
  if (!supportsFolders()) return null

  if (folder.status !== 'open') {
    return (
      <DialogSection title={t('folderTitle')} description={t('folderNote')}>
        <Button
          variant="outline"
          className="self-start"
          disabled={busy}
          onClick={() => void run(chooseFolder)}
        >
          {t(busy ? 'folderChoosing' : 'folderChoose')}
        </Button>
      </DialogSection>
    )
  }
  return (
    <>
      <DialogSection
        title={t('folderTitle')}
        description={
          <>
            <p>
              <Trans
                t={t}
                i18nKey="folderInUse"
                values={{ name: folder.name }}
                components={{
                  name: <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground" />
                }}
              />
            </p>
            <p className="mt-1.5">{t('folderInUseNote')}</p>
          </>
        }
      >
        <Button
          variant="outline"
          className="self-start"
          disabled={busy}
          onClick={() => void run(leaveFolder)}
        >
          {t('folderLeave')}
        </Button>
      </DialogSection>
      <RemovedPhotos onOffered={onOffered} />
    </>
  )
}
