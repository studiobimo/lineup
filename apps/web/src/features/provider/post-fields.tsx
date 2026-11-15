import { useTranslation } from 'react-i18next'

import { DateTimePicker } from '@/components/date-time-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { instagram } from '@/features/planner/network-profile'
import { cn } from '@/lib/utils'

import { localTimeZone } from './post-time'

const CAPTION_FIELD = 'post-caption'
const TIME_FIELD = 'post-time'
const CAPTION_COUNT = 'post-caption-count'
const TIME_NOTE = 'post-time-note'

export interface FieldProps {
  value: string
  invalid: boolean
  onBlur: () => void
  onChange: (value: string) => void
}

export function CaptionField({ value, invalid, onBlur, onChange }: FieldProps) {
  const { t } = useTranslation('provider')
  const { captionLimit: limit } = instagram
  const over = value.length - limit
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={CAPTION_FIELD}>{t('post.caption')}</Label>
      <Textarea
        id={CAPTION_FIELD}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={CAPTION_COUNT}
        onBlur={onBlur}
        onChange={({ target }) => onChange(target.value)}
      />
      <p
        id={CAPTION_COUNT}
        className={cn(
          'text-right text-xs text-muted-foreground tabular-nums',
          over > 0 && 'text-destructive-foreground'
        )}
      >
        {over > 0
          ? t('post.captionOver', { over, limit })
          : t('post.captionCount', { count: value.length, limit })}
      </p>
    </div>
  )
}

export function TimeField({ value, invalid, onBlur, onChange }: FieldProps) {
  const { t } = useTranslation('provider')
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={TIME_FIELD}>{t('post.time')}</Label>
      <DateTimePicker
        id={TIME_FIELD}
        value={value}
        invalid={invalid}
        aria-describedby={TIME_NOTE}
        minDate={new Date()}
        onBlur={onBlur}
        onChange={onChange}
      />
      <p
        id={TIME_NOTE}
        aria-live="polite"
        className={cn('text-xs text-muted-foreground', invalid && 'text-destructive-foreground')}
      >
        {invalid ? t('post.timeInvalid') : t('post.timeZone', { zone: localTimeZone() })}
      </p>
    </div>
  )
}
