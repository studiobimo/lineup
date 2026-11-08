import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import '@/i18n/config'

window.scrollTo = () => {}

window.matchMedia = () =>
  ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList

HTMLCanvasElement.prototype.getContext = () => null

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
