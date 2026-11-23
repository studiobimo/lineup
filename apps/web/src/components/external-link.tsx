import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function ExternalLink({ className, children, ...props }: ComponentProps<'a'>) {
  return (
    <a target="_blank" rel="noreferrer" className={cn('underline', className)} {...props}>
      {children}
    </a>
  )
}
