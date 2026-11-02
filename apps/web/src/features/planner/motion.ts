/** Physical moves are springs, so they stay smooth when a new drag interrupts them. */
export const settle = { type: 'spring', visualDuration: 0.32, bounce: 0.1 } as const

/** A change of opacity alone, which nothing interrupts and which needs no spring. */
export const fade = { duration: 0.15 } as const

/** How a bar comes up from the bottom of the page and goes back. */
export const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: settle
} as const

/** Above resting cells, so a passing cell never slides under them, and below the page header. */
export const GLIDING_Z = 5
