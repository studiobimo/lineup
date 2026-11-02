export const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

/** Every browser on an iPhone says Safari, so this rules out the others by their own names. */
export const isSafari = () =>
  /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg/.test(navigator.userAgent)

export const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true
