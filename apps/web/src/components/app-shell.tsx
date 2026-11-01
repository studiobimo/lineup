import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/theme-toggle'
import { site } from '@/config/site'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
        <span className="font-heading text-xl">{site.name}</span>
        <ThemeToggle />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
