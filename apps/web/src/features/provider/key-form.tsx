import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keyInputSchema, type KeyInput, type Profile } from 'lineup-contract'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { ExternalLink } from '@/components/external-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { provider } from '@/config/provider'

import { answer, providerApi, ProviderRequestError } from './api'
import { saveConnection } from './connection'
import { PROVIDER_KEY } from './queries'
import { useProblemText } from './use-problem-text'

const KEY_FIELD = 'provider-key'
const KEY_ERROR = 'provider-key-error'

/** The key stays in this form until it is sent, and goes when the form does. */
export function KeyForm({ onSaved, onCancel }: { onSaved?: () => void; onCancel?: () => void }) {
  const { t } = useTranslation('provider')
  const queryClient = useQueryClient()
  const problemText = useProblemText()
  const [profiles, setProfiles] = useState<Profile[]>()

  const save = useMutation({
    mutationFn: (json: KeyInput) => answer(providerApi.key.$put({ json })),
    onSuccess: async (status) => {
      saveConnection(status)
      await queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY] })
      onSaved?.()
    },
    onError: (error) => {
      // The form's error, not a failure: the same key goes again with the choice.
      if (error instanceof ProviderRequestError && error.problem?.profiles) {
        setProfiles(error.problem.profiles)
      }
    }
  })

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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={KEY_FIELD}>{t('key.label', { provider: provider.name })}</Label>
            <Input
              id={KEY_FIELD}
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={choosing}
              value={field.state.value}
              aria-invalid={field.state.meta.errors.length > 0 || undefined}
              aria-describedby={field.state.meta.errors.length > 0 ? KEY_ERROR : undefined}
              onBlur={field.handleBlur}
              onChange={({ target }) => field.handleChange(target.value)}
            />
            {field.state.meta.errors.length > 0 && (
              <p id={KEY_ERROR} role="alert" className="text-sm text-destructive-foreground">
                {t('key.invalid')}
              </p>
            )}
          </div>
        )}
      </form.Field>
      {profiles && (
        <form.Field name="profileId">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label>{t('key.profile')}</Label>
              <Select
                items={profiles.map(({ id, name }) => ({ value: id, label: name }))}
                value={field.state.value ?? null}
                onValueChange={(value) => field.handleChange(value ?? undefined)}
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
          )}
        </form.Field>
      )}
      {problem && !needsChoice && (
        <Alert variant="error">
          <AlertDescription>{problemText(problem)}</AlertDescription>
        </Alert>
      )}
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
