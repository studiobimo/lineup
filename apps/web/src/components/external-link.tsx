import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Opens in a new tab, and tells the page it goes to nothing about this one. */
export function ExternalLink({ className, children, ...props }: ComponentProps<'a'>) {
  return (
    <a target="_blank" rel="noreferrer" className={cn('underline', className)} {...props}>
      {children}
    </a>
  )
}
