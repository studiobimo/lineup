import { type ChangeEvent, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Group } from '@/components/ui/group'
import { toastManager } from '@/components/ui/toast'
import { useFolderAction } from '@/features/planner/use-folder-action'
import { createBackup, readBackup } from '@/features/planner/backup'
import { boardStore, plannerStore } from '@/features/planner/planner'
import { download } from '@/lib/download'

const EXTENSION = '.lineup'

export function BackupActions({ onRestored }: { onRestored: () => void }) {
  const { t } = useTranslation('settings')
  const input = useRef<HTMLInputElement>(null)
  const { busy, run } = useFolderAction()

  const backUp = async () => {
    const file = await createBackup(boardStore, plannerStore.getState().board)
    const day = new Date().toISOString().slice(0, 10)
    download(file, `lineup-${day}${EXTENSION}`)
  }

  const restoreFrom = async (file: File) => {
    await plannerStore.getState().restore(await readBackup(file))
    toastManager.add({ type: 'success', title: t('restored') })
    onRestored()
  }

  const restore = ({ target }: ChangeEvent<HTMLInputElement>) => {
    const file = target.files?.[0]
    target.value = ''
    if (file) void run(() => restoreFrom(file), 'restoreFailed')
  }

  return (
    <Group>
      <Button variant="outline" disabled={busy} onClick={() => void run(backUp, 'backupFailed')}>
        {t('backUp')}
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {t('restore')}
      </Button>
      <input ref={input} type="file" accept={EXTENSION} hidden onChange={restore} />
    </Group>
  )
}
