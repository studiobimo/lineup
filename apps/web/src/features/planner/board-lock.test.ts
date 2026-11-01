import { describe, expect, it, vi } from 'vitest'

import { holdBoard } from './board-lock'

const settled = () => new Promise((resolve) => setTimeout(resolve))

/** One lock with a queue, stealing included, as far as holdBoard reaches into the real one. */
function fakeLocks() {
  type Callback = (lock: Lock | null) => unknown
  interface Holder {
    run: Callback
    resolve: (value: unknown) => void
    reject: (reason: Error) => void
    signal?: AbortSignal
  }
  const lock = {} as Lock
  let holder: Holder | undefined
  const queue: Holder[] = []

  const grant = (next: Holder) => {
    holder = next
    void Promise.resolve(next.run(lock)).then((value) => {
      if (holder !== next) return
      holder = undefined
      next.resolve(value)
      const waiting = queue.shift()
      if (waiting) grant(waiting)
    })
  }

  return {
    request(_name: string, options: LockOptions, run: Callback) {
      return new Promise((resolve, reject) => {
        const entry = { run, resolve, reject, signal: options.signal }
        if (options.steal) {
          holder?.reject(new Error('stolen'))
          grant(entry)
        } else if (!holder) {
          grant(entry)
        } else if (options.ifAvailable) {
          void Promise.resolve(run(null)).then(resolve)
        } else {
          queue.push(entry)
          options.signal?.addEventListener('abort', () => {
            queue.splice(queue.indexOf(entry), 1)
            reject(new Error('aborted'))
          })
        }
      })
    }
  } as unknown as LockManager
}

function tab(locks: LockManager | undefined) {
  const onActive = vi.fn()
  const onElsewhere = vi.fn()
  return { onActive, onElsewhere, hold: holdBoard({ onActive, onElsewhere }, locks) }
}

describe('holdBoard', () => {
  it('makes the first tab active', async () => {
    const first = tab(fakeLocks())
    await settled()
    expect(first.onActive).toHaveBeenCalledOnce()
    expect(first.onElsewhere).not.toHaveBeenCalled()
  })

  it('leaves a second tab out until it is given the board', async () => {
    const locks = fakeLocks()
    const first = tab(locks)
    await settled()
    const second = tab(locks)
    await settled()
    expect(second.onElsewhere).toHaveBeenCalledOnce()
    expect(second.onActive).not.toHaveBeenCalled()

    first.hold.release()
    await settled()
    expect(second.onActive).toHaveBeenCalledOnce()
  })

  it('takes the board from a tab that is still open, which then waits its turn', async () => {
    const locks = fakeLocks()
    const first = tab(locks)
    await settled()
    const second = tab(locks)
    await settled()

    second.hold.takeOver()
    await settled()
    expect(second.onActive).toHaveBeenCalledOnce()
    expect(first.onElsewhere).toHaveBeenCalledOnce()

    second.hold.release()
    await settled()
    expect(first.onActive).toHaveBeenCalledTimes(2)
  })

  it('stays out of line once it has been released', async () => {
    const locks = fakeLocks()
    const first = tab(locks)
    await settled()
    const second = tab(locks)
    await settled()

    second.hold.release()
    first.hold.release()
    await settled()
    expect(second.onActive).not.toHaveBeenCalled()
  })

  it('goes ahead alone where the browser has no locks', () => {
    const only = tab(undefined)
    expect(only.onActive).toHaveBeenCalledOnce()
  })
})
