import { CalendarIcon } from 'lucide-react'
import { Fragment, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import i18n from '@/i18n/config'
import { dateTimeFormat } from '@/i18n/format'
import { centredScrollTop } from '@/lib/centred-scroll-top'
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

const toDate = ({ date, hour, minute }: Parts) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

function prefersTwentyFourHour() {
  const { hourCycle } = dateTimeFormat({ hour: 'numeric' }).resolvedOptions()
  return hourCycle === 'h23' || hourCycle === 'h24'
}

interface Option {
  value: number
  label: string
  disabled?: boolean
  note?: string
}

// ~keep From `start` up to but not including `end`, in epoch milliseconds.
export interface TimeMark {
  start: number
  end: number
  label: string
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

const noteFor = (marks: TimeMark[], from: number, to: number) => {
  const hit = marks.filter(({ start, end }) => from < end && to > start)
  return hit.length > 0 ? hit.map(({ label }) => label).join(' ') : undefined
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
  const uid = useId()

  useEffect(() => {
    const item = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    const viewport = list.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (item && viewport) viewport.scrollTop = centredScrollTop(item, viewport)
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = options.filter(({ disabled }) => !disabled)
    const index = enabled.findIndex(({ value }) => value === selected)
    const next = {
      ArrowDown: Math.min(index + 1, enabled.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: enabled.length - 1
    }[event.key]
    if (next === undefined || enabled.length === 0) return
    event.preventDefault()
    onSelect(enabled[next].value)
    const at = options.indexOf(enabled[next])
    list.current?.querySelectorAll<HTMLElement>('[role="option"]')[at]?.focus()
  }

  const tabbable = selected ?? options.find(({ disabled }) => !disabled)?.value
  return (
    <div className="relative w-16 rounded-lg border">
      {/* ~keep The scroll area sets its own position, so it cannot be the absolute element: it
          would size the row to its list and make the columns taller than the calendar. */}
      <div className="absolute inset-0">
        <ScrollArea scrollFade>
          <div
            ref={list}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-orientation="vertical"
            className="relative flex flex-col gap-0.5 p-1"
            onKeyDown={onKeyDown}
          >
            {options.map(({ value, label: text, disabled, note }) => (
              <Fragment key={value}>
                <button
                  type="button"
                  role="option"
                  disabled={disabled}
                  title={note}
                  aria-describedby={note ? `${uid}-${value}` : undefined}
                  tabIndex={value === tabbable ? 0 : -1}
                  aria-selected={value === selected}
                  className="relative flex h-8 w-full shrink-0 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-selected:bg-primary aria-selected:text-primary-foreground"
                  onClick={() => onSelect(value)}
                >
                  {text}
                  {note && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warning"
                    />
                  )}
                </button>
                {note && (
                  <span id={`${uid}-${value}`} hidden>
                    {note}
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

const range = (count: number, first = 0) =>
  Array.from({ length: count }, (_, i) => ({ value: first + i, label: pad(first + i) }))

// ~keep The calendar library names days and months in English unless handed a date-fns locale,
// which would ship every language; Intl already knows the active one.
function calendarFormatters() {
  const language = i18n.resolvedLanguage ?? i18n.language
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' })
  const caption = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' })
  const month = new Intl.DateTimeFormat(language, { month: 'short' })
  return {
    formatWeekdayName: (date: Date) => weekday.format(date),
    formatCaption: (date: Date) => caption.format(date),
    formatMonthDropdown: (date: Date) => month.format(date)
  }
}

function weekStart(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const locale = new Intl.Locale(i18n.resolvedLanguage ?? i18n.language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? 7
  return (firstDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

interface DateTimePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  'aria-describedby'?: string
  minDate?: Date
  hourCycle?: 12 | 24
  marks?: TimeMark[]
  markNote?: string
}

export function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  'aria-describedby': describedBy,
  minDate,
  hourCycle,
  marks = [],
  markNote
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
    const next = {
      date: parts?.date ?? startOfDay(new Date()),
      hour: parts?.hour ?? DEFAULT_HOUR,
      minute: parts?.minute ?? 0,
      ...change
    }
    // ~keep Every change is held to the minimum, not just the default: choosing the minimum hour
    // or day would otherwise leave minutes the columns show as disabled.
    if (minDate && toDate(next) < minDate) {
      const first = startOfDay(minDate)
      if (next.date < first) next.date = first
      if (toDate(next) < minDate) {
        if (next.hour !== minDate.getHours()) next.hour = minDate.getHours()
        next.minute = minDate.getMinutes()
      }
    }
    onChange(stringify(next))
  }

  const hour = parts?.hour
  const pm = hour === undefined ? undefined : hour >= 12
  // ~keep Earlier times only matter on the minimum's own day.
  const day = parts?.date ?? startOfDay(new Date())
  const limited = minDate && startOfDay(minDate).getTime() === day.getTime() ? minDate : undefined
  const minHour = limited?.getHours() ?? 0
  const minMinute = limited && (hour ?? DEFAULT_HOUR) === minHour ? limited.getMinutes() : 0
  const actualHour = (picked: number) =>
    twentyFour ? picked : (picked % 12) + ((pm ?? false) ? 12 : 0)
  // ~keep An hour is marked when any of its minutes is; a minute only when it is itself.
  const startOf = (pickedHour: number, minute = 0) =>
    toDate({ date: day, hour: pickedHour, minute })
  const hours = (twentyFour ? range(24) : range(12, 1)).map((option) => {
    const from = startOf(actualHour(option.value)).getTime()
    return {
      ...option,
      disabled: actualHour(option.value) < minHour,
      note: noteFor(marks, from, from + HOUR_MS - MINUTE_MS + 1)
    }
  })
  const minutes = range(60).map((option) => {
    const from = startOf(hour ?? DEFAULT_HOUR, option.value).getTime()
    return {
      ...option,
      disabled: option.value < minMinute,
      note: noteFor(marks, from, from + 1)
    }
  })
  const shownHour = hour === undefined ? undefined : twentyFour ? hour : hour % 12 || 12
  const setHour = (picked: number) =>
    commit({ hour: twentyFour ? picked : (picked % 12) + (pm ? 12 : 0) })
  const setPeriod = (period: number) =>
    commit({ hour: ((hour ?? DEFAULT_HOUR) % 12) + (period ? 12 : 0) })

  const shown = parts
    ? dateTimeFormat({ dateStyle: 'medium', timeStyle: 'short' }).format(toDate(parts))
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
      <PopoverPopup
        align="start"
        className="max-h-(--available-height) max-w-[calc(100vw-2*var(--spacing-gutter))]"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-col gap-2">
            <Calendar
              mode="single"
              required
              selected={parts?.date}
              defaultMonth={parts?.date ?? minDate}
              disabled={minDate && { before: startOfDay(minDate) }}
              onSelect={(date) => commit({ date })}
              formatters={calendarFormatters()}
              weekStartsOn={weekStart()}
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
          <div className="flex h-44 gap-1.5 sm:h-auto">
            <TimeColumn
              label={t('dateTime.hour')}
              options={hours}
              selected={shownHour}
              onSelect={setHour}
            />
            <TimeColumn
              label={t('dateTime.minute')}
              options={minutes}
              selected={parts?.minute}
              onSelect={(minute) => commit({ minute })}
            />
            {!twentyFour && (
              <TimeColumn
                label={t('dateTime.period')}
                options={[
                  { value: 0, label: t('dateTime.am'), disabled: minHour >= 12 },
                  { value: 1, label: t('dateTime.pm') }
                ]}
                selected={pm === undefined ? undefined : Number(pm)}
                onSelect={setPeriod}
              />
            )}
          </div>
        </div>
        {markNote && marks.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" />
            {markNote}
          </p>
        )}
      </PopoverPopup>
    </Popover>
  )
}
