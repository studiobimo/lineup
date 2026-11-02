import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { ExternalLink } from '@/components/external-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { provider } from '@/config/provider'
import { SettingsNote, SettingsSection } from '@/features/help/settings-section'

import { AccountChoice } from './account-choice'
import { answer, providerApi, ProviderRequestError } from './api'
import { forgetConnection, hasLiveKey, saveConnection, useConnection } from './connection'
import { KeyForm, KeyGuide } from './key-form'
import { ProviderQueries } from './provider-queries'
import { keyQuery, PROVIDER_KEY } from './queries'
import { useProblemText } from './use-problem-text'

function useForgetKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => answer(providerApi.key.$delete()),
    onSuccess: () => {
      forgetConnection()
      queryClient.removeQueries({ queryKey: [PROVIDER_KEY] })
    }
  })
}

function ConnectedKey() {
  const { t, i18n } = useTranslation('provider')
  const problemText = useProblemText()
  const { last4, expiresAt, canPost } = useConnection()
  const [replacing, setReplacing] = useState(false)
  const forget = useForgetKey()
  const { data: status, error } = useQuery(keyQuery)

  // The browser dropped the cookie, or the Worker can no longer open it: this hint is out of date.
  useEffect(() => {
    if (error instanceof ProviderRequestError && error.problem?.status === 404) forgetConnection()
  }, [error])

  useEffect(() => {
    if (status) saveConnection(status)
  }, [status])

  const expires = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(expiresAt ?? 0)
  )
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{t('key.connected', { last4, date: expires })}</p>
      {canPost === false && <SettingsNote>{t('key.readOnly')}</SettingsNote>}
      <AccountChoice />
      {replacing ? (
        <KeyForm onSaved={() => setReplacing(false)} />
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
            {t('key.replace')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            loading={forget.isPending}
            onClick={() => forget.mutate()}
          >
            {t('key.forget')}
          </Button>
        </div>
      )}
      {forget.error && (
        <Alert variant="error">
          <AlertDescription>{problemText(forget.error)}</AlertDescription>
        </Alert>
      )}
      <SettingsNote>
        <Trans
          t={t}
          i18nKey="key.revoke"
          values={{ provider: provider.name }}
          components={{ site: <ExternalLink href={provider.dashboardUrl} /> }}
        />
      </SettingsNote>
    </div>
  )
}

function ProviderConnection() {
  const { t } = useTranslation('provider')
  const connection = useConnection()
  const live = hasLiveKey(connection)
  return (
    <SettingsSection title={t('title')}>
      {live ? (
        <ConnectedKey />
      ) : (
        <>
          {connection.expiresAt && <SettingsNote>{t('key.expired')}</SettingsNote>}
          <KeyGuide />
          <KeyForm />
        </>
      )}
    </SettingsSection>
  )
}

export function ProviderSettings() {
  return (
    <ProviderQueries>
      <ProviderConnection />
    </ProviderQueries>
  )
}
