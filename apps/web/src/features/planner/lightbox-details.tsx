import { Calendar, ImageOff, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { usePlanner } from './planner'

export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground',
        className
      )}
    >
      {children}
    </p>
  )
}

/** When and where the photo was taken, for an image that says. Most say nothing. */
export function ImageDetails({ id }: { id: string }) {
  const { t, i18n } = useTranslation('planner')
  const takenAt = usePlanner(({ images }) => images[id]?.takenAt)
  const place = usePlanner(({ images }) => images[id]?.place)
  const missing = usePlanner(({ images }) => images[id]?.missing)
  if (!takenAt && !place && !missing) return null
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso))
  return (
    <Pill className="gap-3">
      {takenAt && (
        <span className="flex items-center gap-1.5">
          <Calendar aria-hidden className="size-3.5 text-muted-foreground" />
          {t('takenOn', { date: date(takenAt) })}
        </span>
      )}
      {place && (
        <span className="flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 text-muted-foreground" />
          {t('takenIn', { place })}
        </span>
      )}
      {missing && (
        <span className="flex items-center gap-1.5">
          <ImageOff aria-hidden className="size-3.5 text-muted-foreground" />
          {t('missingOriginal')}
        </span>
      )}
    </Pill>
  )
}
