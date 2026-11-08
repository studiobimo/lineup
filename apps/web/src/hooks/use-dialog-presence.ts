import { useEffect, useState } from 'react'

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
