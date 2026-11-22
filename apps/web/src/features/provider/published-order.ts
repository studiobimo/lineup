import type { PublishedPost } from 'lineup-contract'

export type FeedEntry = { cell: string } | { post: PublishedPost }

export interface PublishedCell {
  id: string
  at: number
}

const timeOf = ({ publishedAt }: PublishedPost) =>
  publishedAt ? Date.parse(publishedAt) : -Infinity

// The provider's posts arrive newest first and keep their order. A board cell goes before the ~keep
// first of them that is older, and a post with no time counts as the oldest, so it never jumps
// ahead of a cell whose time is known.
export function feedOrder(cells: PublishedCell[], remote: PublishedPost[]): FeedEntry[] {
  const newestFirst = [...cells].sort((a, b) => (a.at === b.at ? 0 : b.at > a.at ? 1 : -1))
  const entries: FeedEntry[] = []
  let next = 0
  for (const post of remote) {
    while (next < newestFirst.length && newestFirst[next].at >= timeOf(post)) {
      entries.push({ cell: newestFirst[next++].id })
    }
    entries.push({ post })
  }
  for (const { id } of newestFirst.slice(next)) entries.push({ cell: id })
  return entries
}
