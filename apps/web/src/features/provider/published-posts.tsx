import { Suspense } from 'react'

import { AreaBoundary } from '@/components/area-boundary'
import { loadStrings } from '@/i18n/load-strings'
import { lazyComponent } from '@/lib/lazy-component'

import { liveAccount, useConnection } from './connection'
import { StoredCells } from './feed-cells'

const PublishedCells = lazyComponent(
  () => import('./published-cells').then(({ PublishedCells }) => PublishedCells),
  () => loadStrings('provider')
)

export function PublishedPosts() {
  const accountId = liveAccount(useConnection())
  if (!accountId) return <StoredCells />
  return (
    <AreaBoundary className="col-span-full">
      <Suspense fallback={<StoredCells />}>
        <PublishedCells accountId={accountId} />
      </Suspense>
    </AreaBoundary>
  )
}
