import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/theme-toggle'
import { site } from '@/config/site'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2 sm:px-6">
        <span className="font-heading text-lg font-semibold">{site.name}</span>
        <ThemeToggle />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
