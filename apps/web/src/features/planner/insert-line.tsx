import { useStore } from 'zustand'

import { dragStore, gapBeside } from './drag-target'

export function InsertLine() {
  const beside = useStore(dragStore, ({ target }) =>
    target?.kind === 'insert' ? target.beside : undefined
  )
  const gap = beside && gapBeside(beside)
  if (!gap) return null
  return (
    <div
      aria-hidden
      data-insert-line
      className="pointer-events-none fixed z-60 w-1 -translate-x-1/2 bg-primary"
      style={{ left: gap.x, top: gap.top, height: gap.height }}
    />
  )
}
