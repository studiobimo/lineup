import { soonestSchedule } from 'lineup-contract'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DateTimePicker } from '@/components/date-time-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { instagram } from '@/features/planner/network-profile'
import { cn } from '@/lib/utils'

import { localTimeZone } from './post-time'
import { useGapMarks } from './use-spacing'

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

export function CaptionField({ value, invalid, onBlur, onChange }: FieldProps & { cell?: string }) {
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

export function TimeField({
  cell,
  value,
  invalid,
  onBlur,
  onChange
}: FieldProps & { cell: string }) {
  const { t } = useTranslation('provider')
  const marks = useGapMarks(cell)
  const { imageMs, videoMs } = instagram.publishGap
  // ~keep A dialog can stay open past the minimum, so the clock is re-read; a value that has
  // fallen below it shows as invalid instead of being moved.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  const soonest = soonestSchedule(now)
  const tooSoon = value !== '' && Date.parse(value) < soonest.getTime()
  const showInvalid = invalid || tooSoon
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={TIME_FIELD}>{t('post.time')}</Label>
      <DateTimePicker
        id={TIME_FIELD}
        value={value}
        invalid={showInvalid}
        aria-describedby={TIME_NOTE}
        minDate={soonest}
        marks={marks}
        markNote={t('post.spacing.legend', {
          image: imageMs / 60_000,
          video: videoMs / 60_000
        })}
        onBlur={onBlur}
        onChange={onChange}
      />
      <p
        id={TIME_NOTE}
        aria-live="polite"
        className={cn(
          'text-xs text-muted-foreground',
          showInvalid && 'text-destructive-foreground'
        )}
      >
        {showInvalid ? t('post.timeInvalid') : t('post.timeZone', { zone: localTimeZone() })}
      </p>
    </div>
  )
}
