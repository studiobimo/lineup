import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { instagram } from '@/features/planner/network-profile'
import { cn } from '@/lib/utils'

import { localTimeZone } from './post-time'

const CAPTION_FIELD = 'post-caption'
const TIME_FIELD = 'post-time'

interface FieldProps {
  value: string
  invalid: boolean
  onBlur: () => void
  onChange: (value: string) => void
}

export function CaptionField({ value, invalid, onBlur, onChange }: FieldProps) {
  const { t } = useTranslation('provider')
  const over = value.length > instagram.captionLimit
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={CAPTION_FIELD}>{t('post.caption')}</Label>
      <Textarea
        id={CAPTION_FIELD}
        value={value}
        aria-invalid={invalid || undefined}
        onBlur={onBlur}
        onChange={({ target }) => onChange(target.value)}
      />
      <p
        className={cn(
          'text-right text-xs text-muted-foreground tabular-nums',
          over && 'text-destructive-foreground'
        )}
      >
        {t('post.captionCount', { count: value.length, limit: instagram.captionLimit })}
      </p>
    </div>
  )
}

export function TimeField({ value, invalid, onBlur, onChange }: FieldProps) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={TIME_FIELD}>{t('post.time')}</Label>
      <Input
        id={TIME_FIELD}
        type="datetime-local"
        value={value}
        aria-invalid={invalid || undefined}
        onBlur={onBlur}
        onChange={({ target }) => onChange(target.value)}
      />
      <p className={cn('text-xs text-muted-foreground', invalid && 'text-destructive-foreground')}>
        {invalid ? t('post.timeInvalid') : t('post.timeZone', { zone: localTimeZone() })}
      </p>
    </div>
  )
}
