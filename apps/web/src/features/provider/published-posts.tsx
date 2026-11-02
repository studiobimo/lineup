import { Suspense } from 'react'

import { AreaBoundary } from '@/components/area-boundary'
import { loadStrings } from '@/i18n/load-strings'
import { lazyComponent } from '@/lib/lazy-component'

import { liveAccount, useConnection } from './connection'

const PublishedCells = lazyComponent(
  () => import('./published-cells').then(({ PublishedCells }) => PublishedCells),
  () => loadStrings('provider')
)

/** All of this that reaches the first load: with no key, nothing else is fetched (ADR-0018). */
export function PublishedPosts() {
  const accountId = liveAccount(useConnection())
  if (!accountId) return null
  return (
    <AreaBoundary className="col-span-full">
      <Suspense>
        <PublishedCells accountId={accountId} />
      </Suspense>
    </AreaBoundary>
  )
}
