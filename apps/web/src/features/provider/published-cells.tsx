import type { PublishedPost } from 'lineup-contract'
import { Lock } from 'lucide-react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CellBadge } from '@/features/planner/cell-controls'
import { settle } from '@/features/planner/motion'
import { cellShape, instagram } from '@/features/planner/network-profile'
import { usePlanner } from '@/features/planner/planner'
import { dateTimeFormat } from '@/i18n/format'

import { OrderNoticeDialog } from './order-notice-dialog'
import { ProviderQueries } from './provider-queries'
import { PublishedPicture } from './published-picture'
import { usePublishedPosts } from './use-connected-account'
import { usePostSync } from './use-post-sync'
import { useProblemText } from './use-problem-text'

function PublishedCell({ post, position }: { post: PublishedPost; position: number }) {
  const { t } = useTranslation('provider')
  const { publishedAt } = post
  const label = publishedAt
    ? t('published.cellOn', {
        date: dateTimeFormat({ dateStyle: 'medium' }).format(new Date(publishedAt))
      })
    : t('published.cell')
  return (
    <m.div
      layout
      layoutDependency={position}
      transition={{ layout: settle }}
      className="relative overflow-hidden bg-muted"
      style={cellShape}
    >
      <PublishedPicture post={post} label={label} />
      <div className="pointer-events-none absolute bottom-1 left-1">
        <CellBadge icon={Lock} />
      </div>
    </m.div>
  )
}

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
  const planned = usePlanner(({ board }) => board.grid.length)
  const { posts, error, refetch } = usePublishedPosts(accountId)
  usePostSync(accountId)
  return (
    <>
      {posts ? (
        posts.map((post, index) => (
          <PublishedCell key={post.id} post={post} position={planned + index} />
        ))
      ) : error ? (
        <Failure error={error} onRetry={() => void refetch()} />
      ) : (
        Array.from({ length: instagram.columns }, (_, cell) => (
          <Skeleton key={cell} style={cellShape} />
        ))
      )}
      <OrderNoticeDialog posts={posts ?? []} />
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
