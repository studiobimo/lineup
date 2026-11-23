import { useTranslation } from 'react-i18next'

import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { formatPostTime, toFieldTime } from './post-time'
import { isMisordered } from './use-misordered'
import { useSpacing } from './use-spacing'

interface ScheduleWarningProps {
  cell: string
  when: string
  onUse: (when: string) => void
}

const MINUTE_MS = 60_000

// ~keep
// One alert, not two: posts that would go out in the wrong order say so and nothing else, since
// the spacing between them means little until the order is right.
export function ScheduleWarning({ cell, when, onUse }: ScheduleWarningProps) {
  const { t } = useTranslation('provider')
  const spacing = useSpacing(cell, when)
  if (isMisordered(cell, when)) {
    return (
      <Alert variant="warning">
        <AlertDescription>{t('post.outOfOrder')}</AlertDescription>
      </Alert>
    )
  }
  if (!spacing) return null
  const { near, suggested } = spacing
  const video = near.some(({ slot }) => slot.video) || near.length === 0
  return (
    <Alert variant="warning">
      <AlertDescription>
        {near.map(({ side, slot, position }) => (
          <p key={side}>
            {t(side === 'before' ? 'post.spacing.before' : 'post.spacing.after', {
              position,
              minutes: Math.round(slot.gap / MINUTE_MS)
            })}
          </p>
        ))}
        <p>{t(video ? 'post.spacing.video' : 'post.spacing.image')}</p>
        {!suggested && <p>{t('post.spacing.noRoom')}</p>}
      </AlertDescription>
      {suggested && (
        <AlertAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onUse(toFieldTime(suggested))}
          >
            {t('post.spacing.use', { time: formatPostTime(suggested.toISOString()) })}
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
