import { CalendarIcon } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import { dateTimeFormat } from '@/i18n/format'
import { cn } from '@/lib/utils'

const DEFAULT_HOUR = 9

interface Parts {
  date: Date
  hour: number
  minute: number
}

const pad = (n: number) => String(n).padStart(2, '0')

// ~keep The value is a wall-clock `YYYY-MM-DDTHH:mm` string, the same shape as a native
// datetime-local input, so it never goes through a time zone.
function parse(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  return { date: new Date(year, month - 1, day), hour, minute }
}

const stringify = ({ date, hour, minute }: Parts) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

function prefersTwentyFourHour() {
  const { hourCycle } = dateTimeFormat({ hour: 'numeric' }).resolvedOptions()
  return hourCycle === 'h23' || hourCycle === 'h24'
}

interface Option {
  value: number
  label: string
}

interface TimeColumnProps {
  label: string
  options: Option[]
  selected: number | undefined
  onSelect: (value: number) => void
}

// ~keep A listbox whose selection follows focus, as the native picker's columns do.
function TimeColumn({ label, options, selected, onSelect }: TimeColumnProps) {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const item = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    // ~keep scrollIntoView would also scroll the page behind the popup.
    if (item && list.current) list.current.scrollTop = item.offsetTop - list.current.offsetTop
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.findIndex(({ value }) => value === selected)
    const next = {
      ArrowDown: Math.min(index + 1, options.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: options.length - 1
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onSelect(options[next].value)
    list.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus()
  }

  const tabbable = selected ?? options[0].value
  return (
    <div
      ref={list}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-orientation="vertical"
      className="relative flex max-h-full min-w-12 flex-1 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1"
      onKeyDown={onKeyDown}
    >
      {options.map(({ value, label: text }) => (
        <button
          key={value}
          type="button"
          role="option"
          tabIndex={value === tabbable ? 0 : -1}
          aria-selected={value === selected}
          className="flex h-8 w-full shrink-0 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-primary aria-selected:text-primary-foreground"
          onClick={() => onSelect(value)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

const range = (count: number, first = 0) =>
  Array.from({ length: count }, (_, i) => ({ value: first + i, label: pad(first + i) }))

interface DateTimePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  'aria-describedby'?: string
  minDate?: Date
  hourCycle?: 12 | 24
}

export function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  'aria-describedby': describedBy,
  minDate,
  hourCycle
}: DateTimePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const parts = parse(value)
  const twentyFour = hourCycle ? hourCycle === 24 : prefersTwentyFourHour()

  // ~keep Blur is reported when the popup closes: opening it moves focus off the
  // trigger, which would otherwise mark the field as visited too early.
  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) onBlur?.()
  }

  function commit(change: Partial<Parts>) {
    onChange(
      stringify({
        date: parts?.date ?? startOfDay(new Date()),
        hour: parts?.hour ?? DEFAULT_HOUR,
        minute: parts?.minute ?? 0,
        ...change
      })
    )
  }

  const hour = parts?.hour
  const pm = hour === undefined ? undefined : hour >= 12
  const hours = twentyFour ? range(24) : range(12, 1)
  const shownHour = hour === undefined ? undefined : twentyFour ? hour : hour % 12 || 12
  const setHour = (picked: number) =>
    commit({ hour: twentyFour ? picked : (picked % 12) + (pm ? 12 : 0) })
  const setPeriod = (period: number) =>
    commit({ hour: ((hour ?? DEFAULT_HOUR) % 12) + (period ? 12 : 0) })

  const shown = parts
    ? dateTimeFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(
          parts.date.getFullYear(),
          parts.date.getMonth(),
          parts.date.getDate(),
          parts.hour,
          parts.minute
        )
      )
    : t('dateTime.placeholder')

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn('w-full justify-start font-normal', !parts && 'text-muted-foreground')}
          />
        }
      >
        <CalendarIcon aria-hidden="true" />
        {shown}
      </PopoverTrigger>
      <PopoverPopup align="start" className="max-w-[calc(100vw-2*var(--spacing-gutter))]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-col gap-2">
            <Calendar
              mode="single"
              required
              selected={parts?.date}
              defaultMonth={parts?.date ?? minDate}
              disabled={minDate && { before: startOfDay(minDate) }}
              onSelect={(date) => commit({ date })}
              classNames={{ weekday: 'text-muted-foreground' }}
              labels={{
                // ~keep The default label spells the day as an ordinal, which does not contain the
                // number the button shows, so assistive tech and voice control miss it.
                labelDayButton: (date) => dateTimeFormat({ dateStyle: 'full' }).format(date),
                labelPrevious: () => t('dateTime.previousMonth'),
                labelNext: () => t('dateTime.nextMonth')
              }}
            />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => onChange('')}>
                {t('dateTime.clear')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => commit({ date: startOfDay(new Date()) })}
              >
                {t('dateTime.today')}
              </Button>
            </div>
          </div>
          <div className="flex h-36 gap-1.5 sm:h-auto sm:max-h-80">
            <TimeColumn
              label={t('dateTime.hour')}
              options={hours}
              selected={shownHour}
              onSelect={setHour}
            />
            <TimeColumn
              label={t('dateTime.minute')}
              options={range(60)}
              selected={parts?.minute}
              onSelect={(minute) => commit({ minute })}
            />
            {!twentyFour && (
              <TimeColumn
                label={t('dateTime.period')}
                options={[
                  { value: 0, label: t('dateTime.am') },
                  { value: 1, label: t('dateTime.pm') }
                ]}
                selected={pm === undefined ? undefined : Number(pm)}
                onSelect={setPeriod}
              />
            )}
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  )
}
