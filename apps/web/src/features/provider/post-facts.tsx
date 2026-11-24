import type { ScheduledPost } from 'lineup-contract'
import { useTranslation } from 'react-i18next'

type Facts = Pick<ScheduledPost, 'collaborators' | 'droppedCollaborators'>

const names = (usernames: string[]) => usernames.map((name) => `@${name}`).join(', ')

export function PostFacts({ collaborators, droppedCollaborators }: Facts) {
  const { t } = useTranslation('provider')
  const dropped = droppedCollaborators ?? []
  const kept = (collaborators ?? []).filter(
    (name) => !dropped.some(({ username }) => username === name)
  )
  if (kept.length === 0 && dropped.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-sm">
      {kept.length > 0 && (
        <p className="wrap-anywhere">
          {t('post.facts.collaborators', { count: kept.length, usernames: names(kept) })}
        </p>
      )}
      {dropped.map(({ username, reason }) => (
        <p key={username} className="text-destructive-foreground wrap-anywhere">
          {t('post.facts.dropped', { name: username, reason })}
        </p>
      ))}
    </div>
  )
}
