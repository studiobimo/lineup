import { useForm } from '@tanstack/react-form'
import { keyInputSchema, type KeyInput, type Profile } from 'lineup-contract'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { ExternalLink } from '@/components/external-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { provider } from '@/config/provider'

import { providerApi, ProviderRequestError } from './api'
import { saveConnection } from './connection'
import { ErrorNotice } from './error-notice'
import { useProviderAction } from './use-provider-action'

const KEY_FIELD = 'provider-key'
const KEY_ERROR = 'provider-key-error'

function useSaveKey(setProfiles: (profiles: Profile[]) => void, onSaved?: () => void) {
  return useProviderAction((json: KeyInput) => providerApi.key.$put({ json }), {
    onSuccess: (status) => {
      saveConnection(status)
      onSaved?.()
    },
    onError: (error) => {
      if (error instanceof ProviderRequestError && error.problem?.profiles) {
        setProfiles(error.problem.profiles)
      }
    }
  })
}

function KeyField({
  value,
  invalid,
  disabled,
  onBlur,
  onChange
}: {
  value: string
  invalid: boolean
  disabled: boolean
  onBlur: () => void
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={KEY_FIELD}>{t('key.label', { provider: provider.name })}</Label>
      <Input
        id={KEY_FIELD}
        type="password"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? KEY_ERROR : undefined}
        onBlur={onBlur}
        onChange={({ target }) => onChange(target.value)}
      />
      {invalid && (
        <p id={KEY_ERROR} role="alert" className="text-sm text-destructive-foreground">
          {t('key.invalid')}
        </p>
      )}
    </div>
  )
}

function ProfileField({
  profiles,
  value,
  onChange
}: {
  profiles: Profile[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t('key.profile')}</Label>
      <Select
        items={profiles.map(({ id, name }) => ({ value: id, label: name }))}
        value={value ?? null}
        onValueChange={(next) => onChange(next ?? undefined)}
      >
        <SelectTrigger aria-label={t('key.profile')}>
          <SelectValue placeholder={t('key.chooseProfile')} />
        </SelectTrigger>
        <SelectPopup>
          {profiles.map(({ id, name }) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  )
}

export function KeyForm({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const { t } = useTranslation('provider')
  const [profiles, setProfiles] = useState<Profile[]>()

  const save = useSaveKey(setProfiles, onSaved)

  const form = useForm({
    defaultValues: { key: '', profileId: undefined } as KeyInput,
    validators: { onSubmit: keyInputSchema },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined)
  })

  const choosing = profiles !== undefined
  const problem = save.error
  const needsChoice =
    problem instanceof ProviderRequestError && problem.problem?.code === 'profile_required'

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="key">
        {(field) => (
          <KeyField
            value={field.state.value}
            invalid={field.state.meta.errors.length > 0}
            disabled={choosing}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
          />
        )}
      </form.Field>
      {profiles && (
        <form.Field name="profileId">
          {(field) => (
            <ProfileField
              profiles={profiles}
              value={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
      )}
      {!needsChoice && <ErrorNotice error={problem} />}
      <form.Subscribe selector={({ values }) => choosing && !values.profileId}>
        {(unchosen) => (
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending} disabled={unchosen}>
              {t('key.save')}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t('key.cancel')}
              </Button>
            )}
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}

export function KeyGuide() {
  const { t } = useTranslation('provider')
  return (
    <ol className="list-outside list-decimal space-y-1 ps-4 text-xs text-muted-foreground">
      <li>
        <Trans
          t={t}
          i18nKey="guide.account"
          values={{ provider: provider.name }}
          components={{ site: <ExternalLink href={provider.signUpUrl} /> }}
        />
      </li>
      <li>{t('guide.instagram')}</li>
      <li>{t('guide.key')}</li>
    </ol>
  )
}
