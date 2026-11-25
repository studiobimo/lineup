import { ChevronDownIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PostSectionProps {
  title: string
  children: ReactNode
}

export function PostSection({ title, children }: PostSectionProps) {
  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger
        className="w-full justify-between data-panel-open:[&_svg]:rotate-180"
        render={<Button variant="ghost" />}
      >
        {title}
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 transition-transform" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-3 px-3 pt-1 pb-3">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
