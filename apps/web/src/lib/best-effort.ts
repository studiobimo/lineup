export function bestEffort(action: () => void) {
  try {
    action()
    return true
  } catch {
    return false
  }
}
