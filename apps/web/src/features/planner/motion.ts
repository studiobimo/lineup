export const settle = { type: 'spring', visualDuration: 0.32, bounce: 0.1 } as const

export const fade = { duration: 0.15 } as const

export const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: settle
} as const

export const GLIDING_Z = 5
