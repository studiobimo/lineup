import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal/legal-page'
import { loadLegalStrings } from '@/features/legal/legal-strings'

export const Route = createFileRoute('/privacy')({
  loader: loadLegalStrings,
  component: () => <LegalPage name="privacy" />
})
