import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cellShape, instagram } from '@/features/planner/network-profile'

import { FeedCells } from './feed-cells'
import { ProviderQueries } from './provider-queries'
import { PublishedCell } from './published-cell'
import { usePublishedPosts } from './use-connected-account'
import { usePostSync } from './use-post-sync'
import { usePublishedFeed } from './use-published-feed'
import { useProblemText } from './use-problem-text'

function Failure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation('provider')
  const problemText = useProblemText()
  return (
    <div role="alert" className="col-span-full flex flex-wrap items-center gap-2 py-2 text-sm">
      <p className="text-muted-foreground">
        {t('published.failed')} {problemText(error)}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('tryAgain')}
      </Button>
    </div>
  )
}

function Cells({ accountId }: { accountId: string }) {
  const { posts, error, refetch } = usePublishedPosts(accountId)
  const feed = usePublishedFeed(posts)
  usePostSync(accountId)
  return (
    <>
      <FeedCells
        feed={feed}
        post={(post, position) => <PublishedCell key={post.id} post={post} position={position} />}
      />
      {!posts && error && <Failure error={error} onRetry={() => void refetch()} />}
      {!posts &&
        !error &&
        Array.from({ length: instagram.columns }, (_, cell) => (
          <Skeleton key={cell} style={cellShape} />
        ))}
    </>
  )
}

export function PublishedCells({ accountId }: { accountId: string }) {
  return (
    <ProviderQueries>
      <Cells accountId={accountId} />
    </ProviderQueries>
  )
}
