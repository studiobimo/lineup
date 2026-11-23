import { useQuery } from '@tanstack/react-query'
import type { Account } from 'lineup-contract'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DialogNote } from '@/features/help/dialog-sections'

import { providerApi } from './api'
import { saveConnection, useConnection } from './connection'
import { ErrorNotice } from './error-notice'
import { accountsQuery } from './queries'
import { useProviderAction } from './use-provider-action'

const chooseAccount = ({ id, username }: Account) => saveConnection({ accountId: id, username })

function ConnectAccount() {
  const { t } = useTranslation('provider')
  const connect = useProviderAction(() => providerApi['connect-url'].$get(), {
    cache: 'keep',
    onSuccess: ({ url }) => window.location.assign(url)
  })
  return (
    <div className="flex flex-col gap-2">
      <DialogNote>{t('account.none')}</DialogNote>
      <ErrorNotice error={connect.error} />
      <Button
        variant="outline"
        className="self-start"
        loading={connect.isPending}
        onClick={() => connect.mutate()}
      >
        {t('account.connect')}
      </Button>
    </div>
  )
}

export function AccountChoice() {
  const { t } = useTranslation('provider')
  const { accountId } = useConnection()
  const { data: accounts, error, refetch } = useQuery(accountsQuery)
  const chosen = accounts?.find(({ id }) => id === accountId)
  const only = accounts?.length === 1 ? accounts[0] : undefined

  useEffect(() => {
    if (only && !chosen) chooseAccount(only)
  }, [only, chosen])

  if (error) {
    return (
      <ErrorNotice error={error}>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
          {t('tryAgain')}
        </Button>
      </ErrorNotice>
    )
  }
  if (!accounts) return <Skeleton className="h-9 w-full" />
  if (accounts.length === 0) return <ConnectAccount />

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t('account.label')}</Label>
      <Select
        items={accounts.map(({ id, username }) => ({ value: id, label: `@${username}` }))}
        value={chosen?.id ?? null}
        onValueChange={(id) => {
          const account = accounts.find((each) => each.id === id)
          if (account) chooseAccount(account)
        }}
      >
        <SelectTrigger aria-label={t('account.label')}>
          <SelectValue placeholder={t('account.choose')} />
        </SelectTrigger>
        <SelectPopup>
          {accounts.map(({ id, username }) => (
            <SelectItem key={id} value={id}>
              @{username}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {chosen?.needsReconnection && <DialogNote>{t('account.reconnect')}</DialogNote>}
    </div>
  )
}
