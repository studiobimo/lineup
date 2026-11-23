import { useTranslation } from 'react-i18next'

import { ProviderRequestError } from './api'

export function useProblemText() {
  const { t } = useTranslation('provider')
  return (error: Error | null) => {
    if (!error) return undefined
    if (!(error instanceof ProviderRequestError)) return t('problems.internal')
    const { problem } = error
    return problem ? (problem.detail ?? t(`problems.${problem.code}`)) : t('problems.offline')
  }
}
