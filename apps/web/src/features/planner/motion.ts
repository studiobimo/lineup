/** Physical moves are springs, so they stay smooth when a new drag interrupts them. */
export const settle = { type: 'spring', visualDuration: 0.32, bounce: 0.1 } as const

/** Above resting cells, so a passing cell never slides under them, and below the page header. */
export const GLIDING_Z = 5
