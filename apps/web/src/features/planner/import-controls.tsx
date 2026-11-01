import { FolderPlus, ImagePlus } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

import { fromDrop, fromFiles } from './import-source'
import { runImport, useImportProgress } from './import-store'

function hasFiles(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function inTextField(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]')
}

/** The whole window takes a drop or a paste, wherever the pointer is. */
export function ImportTargets() {
  const { t } = useTranslation('planner')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    // Enter and leave fire for every child crossed, so only the count says when it has left.
    let depth = 0
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth += 1
      setDragging(true)
    }
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth -= 1
      if (depth === 0) setDragging(false)
    }
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      if (event.dataTransfer) void runImport(fromDrop(event.dataTransfer.items))
    }
    const paste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files
      if (!files?.length || inTextField(event.target)) return
      void runImport(fromFiles(files))
    }

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
      window.removeEventListener('paste', paste)
    }
  }, [])

  if (!dragging) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-background/80">
      <p className="font-pixel text-3xl">{t('dropHere')}</p>
    </div>
  )
}

export function ImportProgress() {
  const { t } = useTranslation('planner')
  const progress = useImportProgress()
  if (!progress) return null
  return (
    <Progress
      className="px-4 pb-4"
      value={progress.done}
      max={progress.total}
      aria-label={t('importing', progress)}
    >
      <p className="text-sm text-muted-foreground">{t('importing', progress)}</p>
    </Progress>
  )
}

export function ImportButtons() {
  const { t } = useTranslation('planner')
  const busy = useImportProgress() !== null
  const files = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // React has no prop for it, and a folder picker is what makes this a different input.
    if (folder.current) folder.current.webkitdirectory = true
  }, [])

  const choose = ({ target }: ChangeEvent<HTMLInputElement>) => {
    void runImport(fromFiles([...(target.files ?? [])]))
    // Choosing the same file again has to count as a change.
    target.value = ''
  }

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-4">
      <input
        ref={files}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label={t('addImages')}
        onChange={choose}
      />
      <input
        ref={folder}
        type="file"
        multiple
        hidden
        aria-label={t('addFolder')}
        onChange={choose}
      />
      <Button size="sm" disabled={busy} onClick={() => files.current?.click()}>
        <ImagePlus />
        {t('addImages')}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => folder.current?.click()}>
        <FolderPlus />
        {t('addFolder')}
      </Button>
    </div>
  )
}
