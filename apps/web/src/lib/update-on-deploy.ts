/**
 * The service worker serves the cached app first and takes over with a new one in the background,
 * but a page keeps running the code it loaded. Without this, the first visit after a deploy runs
 * the old release, and a reload made before the new worker has finished installing does too.
 *
 * A page that has not been touched reloads at once. One in use waits until it is hidden, so an
 * import or a half-written caption is never cut off.
 */
export function updateOnDeploy(
  container: ServiceWorkerContainer | undefined = navigator.serviceWorker,
  page: Pick<Document, 'visibilityState' | 'addEventListener'> = document,
  reload: () => void = () => location.reload()
) {
  // The first install also takes control, and the page it controls is already current.
  if (!container?.controller) return
  let touched = false
  let reloading = false
  const reloadOnce = () => {
    if (reloading) return
    reloading = true
    reload()
  }
  for (const event of ['pointerdown', 'keydown'] as const) {
    page.addEventListener(event, () => (touched = true), { once: true, capture: true })
  }
  container.addEventListener('controllerchange', () => {
    if (!touched || page.visibilityState === 'hidden') return reloadOnce()
    page.addEventListener('visibilitychange', () => {
      if (page.visibilityState === 'hidden') reloadOnce()
    })
  })
}
