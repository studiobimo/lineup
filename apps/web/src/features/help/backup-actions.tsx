import { type ChangeEvent, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Group } from '@/components/ui/group'
import { toastManager } from '@/components/ui/toast'
import { createBackup, readBackup } from '@/features/planner/backup'
import { boardStore, plannerStore } from '@/features/planner/planner'
import { download } from '@/lib/download'

const EXTENSION = '.lineup'

export function BackupActions({ onRestored }: { onRestored: () => void }) {
  const { t } = useTranslation('help')
  const input = useRef<HTMLInputElement>(null)

  const backUp = async () => {
    try {
      const file = await createBackup(boardStore, plannerStore.getState().board)
      const day = new Date().toISOString().slice(0, 10)
      download(file, `lineup-${day}${EXTENSION}`)
    } catch {
      toastManager.add({ type: 'error', title: t('backupFailed') })
    }
  }

  const restore = async ({ target }: ChangeEvent<HTMLInputElement>) => {
    const file = target.files?.[0]
    // Cleared, or choosing the same file again would change nothing and do nothing.
    target.value = ''
    if (!file) return
    try {
      await plannerStore.getState().restore(await readBackup(file))
      toastManager.add({ type: 'success', title: t('restored') })
      onRestored()
    } catch {
      toastManager.add({ type: 'error', title: t('restoreFailed') })
    }
  }

  return (
    <Group className="mt-3">
      <Button variant="outline" onClick={() => void backUp()}>
        {t('backUp')}
      </Button>
      <Button variant="outline" onClick={() => input.current?.click()}>
        {t('restore')}
      </Button>
      <input
        ref={input}
        type="file"
        accept={EXTENSION}
        hidden
        onChange={(event) => void restore(event)}
      />
    </Group>
  )
}
