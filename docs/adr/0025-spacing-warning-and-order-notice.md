# ADR-0025: Warn about spacing, and say when posts went live out of order

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

Instagram puts a post on the grid when it is published, not when it was scheduled. A carousel with
a video can take minutes to process, so a post scheduled a minute later can go out first, and
the grid then differs from the plan (ZRN-9 only compared scheduled times). A customer hit this.

## Decision

**Lineup warns before scheduling, lets the person ignore the warning, and tells them afterwards
if posts did go out of order. It never changes a post on its own.**

- **Gaps.** A post needs 5 minutes before the next if it is pictures, 15 minutes if it holds a
  video, plus a minute for each 50 MB of its size over 100 MB. They are one set of numbers,
  `instagram.publishGap` in the network profile, because they are a guess to be tuned with real
  publish times. A size that is not known (the stored copy is gone) leaves the base gap.
- **Sizes** are read from the stored publish copies, only for cells with a video, so no new field
  is stored on an image and no migration is needed.
- **The warning** is inline on the schedule and reschedule screens, sharing one alert with the
  ZRN-9 warning (the order warning wins, since spacing means little while the order is wrong).
  It names the post by its place on the grid, and offers the time nearest the chosen one that
  leaves both gaps and is not before the soonest allowed time. With no such time between the
  neighbours it offers none, rather than one that runs into the next post. Schedule is never disabled.
- **The notice.** When a published cell is about to leave the board (ADR-0024) the sync compares
  the provider's `publishedAt` of the posts it scheduled with their scheduled times. A post that
  was scheduled first but went live after a later one is a swap. The posts that left the board
  are remembered (up to 20) so the two halves of a swap may arrive in different syncs. Posts made
  outside Lineup are never compared, as they have no scheduled time here.
- **Where it is kept.** In local storage beside the other device settings
  (`createStoredStore('order-notice')`), not in the board. It is not part of the plan, so it
  does not belong in the history or a backup, and the stored shape of the board does not change,
  so there is no migration. A missing or damaged value reads as no notice, which is tested. Only
  ids and times are kept, never a caption. Nothing leaves the device.
- **The dialog** is an alert dialog, shown when the app opens with an unseen notice or as soon
  as one is recorded. Closing it records the swapped pairs as told, so they do not return.

## Consequences

- The numbers are estimates: a warning may be needless, or a swap may still happen.
- A notice is per browser: it is not shown on another device.
- The notice appears only where the published list is read, that is with a connected account.
