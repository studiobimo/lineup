# ADR-0018: Scheduled posts on the board

- **Status:** Accepted, in part superseded by [ADR-0023](0023-published-cells-leave-the-plan.md): a published cell is drawn among the published posts, not where it was planned
- **Date:** 2026-11-01

## Context

M4 links planned cells to posts that exist at Zernio. A post is a fact about the outside world, and
the board is a plan that can be undone, so the two do not behave alike. Undoing a move must not
forget a post that will still go out, and a scheduled cell that can be dragged away would make the
feed differ from the plan with nothing to say so.

Two constraints shape the rest. Nothing in the planner may call the network, and the app must spend
nothing on the first load for someone who never connects Instagram: the first load is at its limit.

The spike ([results](../research/instagram-apis.md#4-m4-spike-results)) also settled how the key is
narrowed, which ADR-0008 left open.

## Decision

- **A cell's post lives in `board.posts`, by cell.** It holds the post's id, account, time, zone,
  caption and last known status. It goes wherever the board goes, including backups.
- **Undo leaves `board.posts` alone.** Undo and redo restore the arrangement and keep today's posts.
  Scheduling, rescheduling and cancelling are done at Zernio and are not undo steps.
- **A cell with a post is locked,** by the same check as a cell the user locked: `isLocked` also reads
  `board.posts`. Moving, grouping, sorting and deleting already respect that, so none of them needs
  a new rule. Cancelling a post frees the cell.
- **Only grid cells can be scheduled.** The grid is the plan, and the tray is not.
- **Published posts are not board cells.** They are drawn after the grid from the provider's data.
  They take no space in storage, cannot be moved, and are left out of undo and backups. A cell whose
  own post has been published is shown once, as that cell.
- **Status is written back to `board.posts`,** so it still shows offline, and it does not touch the
  history.
- **The planner reads posts, and only `features/provider` calls the network.** It loads lazily, and
  only when this browser says it has a key. That hint is a line in `localStorage` with the last four
  characters and the expiry, the same two things Settings shows. It is what lets a user with no key
  send no request at all.
- **Keys are narrowed to `publishing` and `accounts`** by disabling every other group, with a
  30-day expiry, to the one chosen profile.
- **The Worker refuses a time in the past,** with a minute's margin, as Zernio would publish it at once.
- **Zernio is called through `fetch` with small schemas** in `packages/api`, not its SDK.

## Consequences

- A lock cannot be taken off a scheduled cell, except by cancelling.
- Restoring an old backup can bring back a link to a post that has since gone. A status refresh that
  finds it missing leaves the cell as it was, and the user can cancel it, which clears the link.
- The published posts' image hosts are in the content security policy, so a host change at Instagram
  shows as missing thumbnails until the policy follows.
- Two browsers can each hold a link to the same post only by restoring a backup, since boards do not
  sync.
