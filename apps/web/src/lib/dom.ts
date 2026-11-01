/**
 * A dialog owns the keyboard while it is open, so the page's shortcuts must not reach past it. This
 * asks the page, not the focused element, because focus falls out when a button in it is disabled.
 */
export const dialogIsOpen = () => document.querySelector('[role$="dialog"]') !== null

export function inTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]') !== null
  )
}
