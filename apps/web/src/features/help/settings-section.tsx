import type { ReactNode } from 'react'

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function SettingsNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-muted-foreground">{children}</p>
}
