import type { ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { useProblemText } from './use-problem-text'

interface ErrorNoticeProps {
  error?: Error | null
  text?: string
  className?: string
  children?: ReactNode
}

export function ErrorNotice({ error, text, className, children }: ErrorNoticeProps) {
  const problemText = useProblemText()
  const message = text ?? problemText(error ?? null)
  if (!message) return null
  return (
    <Alert variant="error" className={className}>
      <AlertDescription>{message}</AlertDescription>
      {children}
    </Alert>
  )
}
