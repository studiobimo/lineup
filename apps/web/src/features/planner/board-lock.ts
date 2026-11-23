const LOCK = 'lineup-board'
const HANDOVER_MS = 500

interface HoldOptions {
  onActive: () => void
  onElsewhere: () => void
  patience?: number
}

export interface BoardHold {
  takeOver(): void
  release(): void
}

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
