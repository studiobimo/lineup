import { createFileRoute } from '@tanstack/react-router'

import { legalHead } from '@/features/legal/legal-head'
import { LegalPage } from '@/features/legal/legal-page'
import { loadLegalStrings } from '@/features/legal/legal-strings'

export const Route = createFileRoute('/privacy')({
  loader: loadLegalStrings,
  head: legalHead('privacy'),
  component: () => <LegalPage name="privacy" />
})
