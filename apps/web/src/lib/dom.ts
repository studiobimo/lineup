/** A dialog owns the keyboard while it is open, so the page's shortcuts must not reach past it. */
export function inDialog(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('[role$="dialog"]') !== null
}

export function inTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]') !== null
  )
}
