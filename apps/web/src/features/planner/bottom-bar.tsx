import { type HTMLMotionProps, m } from 'motion/react'

import { cn } from '@/lib/utils'

import { rise } from './motion'

export function BottomBar({ className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <m.div
      {...rise}
      className={cn(
        'fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border bg-popover text-popover-foreground shadow-md',
        className
      )}
      {...props}
    />
  )
}
