import { createFileRoute } from '@tanstack/react-router'

import { LegalPage } from '@/features/legal/legal-page'
import { loadStrings } from '@/i18n/load-strings'

export const Route = createFileRoute('/terms')({
  loader: () => loadStrings('legal'),
  component: () => <LegalPage name="terms" />
})
