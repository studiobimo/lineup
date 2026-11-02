import { useTranslation } from 'react-i18next'

import { ProviderRequestError } from './api'

/** What to tell a person about a failed request, in the provider's own words if it refused. */
export function useProblemText() {
  const { t } = useTranslation('provider')
  return (error: Error | null) => {
    if (!error) return undefined
    if (!(error instanceof ProviderRequestError)) return t('problems.internal')
    const { problem } = error
    return problem ? (problem.detail ?? t(`problems.${problem.code}`)) : t('problems.offline')
  }
}
