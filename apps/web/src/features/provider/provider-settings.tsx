import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { ExternalLink } from '@/components/external-link'
import { IconMenu } from '@/components/icon-menu'
import { provider } from '@/config/provider'
import { DialogNote, DialogSection, DialogStack } from '@/features/help/dialog-sections'
import { dateTimeFormat } from '@/i18n/format'

import { AccountChoice } from './account-choice'
import { providerApi, ProviderRequestError } from './api'
import { forgetConnection, hasLiveKey, saveConnection, useConnection } from './connection'
import { ErrorNotice } from './error-notice'
import { KeyForm, KeyGuide } from './key-form'
import { ProviderQueries } from './provider-queries'
import { keyQuery } from './queries'
import { useProviderAction } from './use-provider-action'

function useForgetKey() {
  return useProviderAction(() => providerApi.key.$delete(), {
    cache: 'remove',
    onSuccess: forgetConnection
  })
}

function ConnectedKey() {
  const { t } = useTranslation('provider')
  const { last4, expiresAt, canPost } = useConnection()
  const [replacing, setReplacing] = useState(false)
  const forget = useForgetKey()
  const { data: status, error } = useQuery(keyQuery)

  useEffect(() => {
    if (error instanceof ProviderRequestError && error.problem?.status === 404) forgetConnection()
  }, [error])

  useEffect(() => {
    if (status) saveConnection(status)
  }, [status])

  const expires = dateTimeFormat({ dateStyle: 'medium' }).format(new Date(expiresAt ?? 0))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/32 py-2.5 ps-3.5 pe-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{provider.name}</p>
          <p className="text-xs text-muted-foreground">
            {t('key.connected', { last4, date: expires })}
          </p>
        </div>
        <IconMenu
          label={t('key.options')}
          icon={<Ellipsis />}
          align="end"
          triggerProps={{ variant: 'ghost', size: 'icon-sm' }}
          items={[
            { label: t('key.replace'), onClick: () => setReplacing(true) },
            {
              label: t('key.forget'),
              variant: 'destructive',
              disabled: forget.isPending,
              onClick: () => forget.mutate()
            }
          ]}
        />
      </div>
      {canPost === false && <DialogNote>{t('key.readOnly')}</DialogNote>}
      {replacing && (
        <KeyForm onSaved={() => setReplacing(false)} onCancel={() => setReplacing(false)} />
      )}
      <ErrorNotice error={forget.error} />
      {!replacing && <AccountChoice />}
    </div>
  )
}

function ProviderConnection() {
  const { t } = useTranslation('provider')
  const connection = useConnection()
  const live = hasLiveKey(connection)
  return (
    <DialogStack>
      <DialogSection
        description={
          !live && connection.expiresAt ? <p className="mb-2">{t('key.expired')}</p> : undefined
        }
      >
        {live ? (
          <ConnectedKey />
        ) : (
          <>
            <KeyGuide />
            <KeyForm />
          </>
        )}
      </DialogSection>
      <DialogSection>
        {live && (
          <DialogNote>
            <Trans
              t={t}
              i18nKey="key.revoke"
              values={{ provider: provider.name }}
              components={{ site: <ExternalLink href={provider.dashboardUrl} /> }}
            />
          </DialogNote>
        )}
        <DialogNote>{t('disclaimer')}</DialogNote>
      </DialogSection>
    </DialogStack>
  )
}

export function ProviderSettings() {
  return (
    <ProviderQueries>
      <ProviderConnection />
    </ProviderQueries>
  )
}
