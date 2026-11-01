import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import '@/i18n/config'

// jsdom lays nothing out, so it has no scrollTo for the router's scroll restoration to call.
window.scrollTo = () => {}

// Nor does it have matchMedia, which the theme reads. A test that cares replaces this.
window.matchMedia = () =>
  ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList

// Nor a canvas to draw on, so cells stay blank. A test that cares replaces this.
HTMLCanvasElement.prototype.getContext = () => null

// Nor what is on screen, so every element counts as seen.
window.IntersectionObserver = class {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
  disconnect() {}
} as unknown as typeof IntersectionObserver
