import { useEffect, useState } from 'react'

/**
 * For a dialog that mounts to open, so that it fades like one that was always there. Base UI
 * animates a change of `open`, and a dialog that arrives open has none, so this one opens a frame
 * later. It also stays mounted until its exit has played, which is when `onClose` runs.
 */
export function useDialogPresence(onClose: () => void) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return {
    close: () => setOpen(false),
    dialog: {
      open,
      onOpenChange: (next: boolean) => setOpen(next),
      onOpenChangeComplete: (finished: boolean) => {
        if (!finished) onClose()
      }
    }
  }
}
