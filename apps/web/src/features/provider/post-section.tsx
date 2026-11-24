import { ChevronDownIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PostSectionProps {
  title: string
  children: ReactNode
}

export function PostSection({ title, children }: PostSectionProps) {
  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24">
        {title}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-3 px-3 pt-1 pb-3">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
