export function inTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]') !== null
  )
}
