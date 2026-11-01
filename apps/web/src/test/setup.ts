import '@testing-library/jest-dom/vitest'
import '@/i18n/config'

// jsdom lays nothing out, so it has no scrollTo for the router's scroll restoration to call.
window.scrollTo = () => {}

// Nor does it have matchMedia, which the theme reads. A test that cares replaces this.
window.matchMedia = () =>
  ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
