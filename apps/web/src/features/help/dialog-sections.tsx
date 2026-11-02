import type { ReactNode } from 'react'

import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset'

/** The sections of one tab, set apart by a rule so that no two run into each other. */
export function DialogStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y *:py-5 *:first:pt-0 *:last:pb-0">{children}</div>
}

/** What it is, then what it does, then what to press: every section reads in that order. */
export function DialogSection({
  title,
  description,
  children
}: {
  title?: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <Fieldset className="flex flex-col gap-3">
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && <FieldsetLegend className="text-sm">{title}</FieldsetLegend>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      )}
      {children}
    </Fieldset>
  )
}

export function DialogNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
