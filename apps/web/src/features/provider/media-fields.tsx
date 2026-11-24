import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface MediaFieldsProps {
  media: ReactNode
  children: ReactNode
  className?: string
}

// Both schedule screens use this, so the picture never moves between them. On a narrow
// screen the picture sits above the fields, capped so it does not fill the whole dialog. ~keep
export function MediaFields({ media, children, className }: MediaFieldsProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-[22rem_minmax(0,1fr)]', className)}>
      <div className="mx-auto w-full max-w-72 sm:max-w-none">{media}</div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </div>
  )
}
