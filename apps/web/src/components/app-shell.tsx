import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/theme-toggle'
import { site } from '@/config/site'

interface AppShellProps {
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ actions, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-gutter">
        <Link to="/" className="font-heading text-xl">
          {site.name}
        </Link>
        <div className="flex items-center gap-1">
          {actions}
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
