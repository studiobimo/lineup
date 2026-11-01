import type { ReactNode } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'

interface BoardGateProps {
  title: string
  description: string
  children: ReactNode
}

/** Stands in for the board when it cannot be shown, and says what would bring it back. */
export function BoardGate({ title, description, children }: BoardGateProps) {
  return (
    <Empty className="min-h-[calc(100dvh-3.5rem)]">
      <EmptyHeader>
        <EmptyTitle>
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>{children}</EmptyContent>
    </Empty>
  )
}
