export const dialogIsOpen = () => document.querySelector('[role$="dialog"]') !== null

export const onButton = (target: EventTarget) => (target as Element).closest('button') !== null

export function inTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]') !== null
  )
}
