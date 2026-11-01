const LOCK = 'lineup-board'

interface HoldOptions {
  onActive: () => void
  onElsewhere: () => void
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
  { onActive, onElsewhere }: HoldOptions,
  locks: LockManager | undefined = navigator.locks
): BoardHold {
  if (!locks) {
    onActive()
    return { takeOver() {}, release() {} }
  }

  let waiting: AbortController | undefined
  let letGo: (() => void) | undefined
  let released = false

  const held = () => {
    if (released) return
    waiting = undefined
    onActive()
    return new Promise<void>((resolve) => (letGo = resolve))
  }

  const wait = () => {
    if (released) return
    onElsewhere()
    const controller = new AbortController()
    waiting = controller
    locks.request(LOCK, { signal: controller.signal }, held).catch(() => {
      // Aborted is this tab taking over. Otherwise another tab took the lock from under it.
      if (!controller.signal.aborted) wait()
    })
  }

  locks
    .request(LOCK, { ifAvailable: true }, (lock) => {
      if (lock) return held()
      wait()
    })
    .catch(wait)

  return {
    takeOver() {
      waiting?.abort()
      locks.request(LOCK, { steal: true }, held).catch(wait)
    },
    release() {
      released = true
      waiting?.abort()
      letGo?.()
    }
  }
}
