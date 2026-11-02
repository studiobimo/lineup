const LOCK = 'lineup-board'
// A reload runs the new page while the old one still holds the lock. That is not another tab.
const HANDOVER_MS = 500

interface HoldOptions {
  onActive: () => void
  onElsewhere: () => void
  /** How long the lock may stay out of reach before that counts as being open elsewhere. */
  patience?: number
}

export interface BoardHold {
  takeOver(): void
  release(): void
}

/**
 * Keeps this tab in line for the board (ADR-0010). The browser hands the lock on when its holder
 * closes, and a frozen phone tab never lets go, which is why `takeOver` does not wait.
 */
export function holdBoard(
  { onActive, onElsewhere, patience = HANDOVER_MS }: HoldOptions,
  locks: LockManager | undefined = navigator.locks
): BoardHold {
  if (!locks) {
    onActive()
    return { takeOver() {}, release() {} }
  }

  let waiting: AbortController | undefined
  let letGo: (() => void) | undefined
  let released = false
  let handover: ReturnType<typeof setTimeout> | undefined

  const held = () => {
    if (released) return
    waiting = undefined
    clearTimeout(handover)
    onActive()
    return new Promise<void>((resolve) => (letGo = resolve))
  }

  const wait = (grace?: number) => {
    if (released) return
    if (grace === undefined) onElsewhere()
    else handover = setTimeout(onElsewhere, grace)
    const controller = new AbortController()
    waiting = controller
    locks.request(LOCK, { signal: controller.signal }, held).catch(() => {
      // Aborted is this tab taking over. Otherwise another tab took the lock from under it.
      if (!controller.signal.aborted) wait()
    })
  }

  wait(patience)

  return {
    takeOver() {
      waiting?.abort()
      locks.request(LOCK, { steal: true }, held).catch(() => wait())
    },
    release() {
      released = true
      clearTimeout(handover)
      waiting?.abort()
      letGo?.()
    }
  }
}
