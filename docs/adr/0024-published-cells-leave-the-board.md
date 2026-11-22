# ADR-0024: A published cell leaves the board

- **Status:** Accepted, supersedes [ADR-0023](0023-published-cells-leave-the-plan.md) and the part of [ADR-0018](0018-posts-on-the-board.md) that kept a published cell on the board
- **Date:** 2026-11-22

## Context

[ADR-0018](0018-posts-on-the-board.md) kept a cell whose post had gone out where it was planned,
locked, and showed the provider's other published posts after the grid. A customer reported what
that produces: two posts that went out in a different order from the one planned sit swapped
against Instagram, and the cells published through Lineup come first, then the planned ones, then
the posts fetched from Instagram. [ADR-0023](0023-published-cells-leave-the-plan.md) drew the board's
published cells among the provider's, by the time each went out, which keeps two copies of the
truth and still guesses at the order. The Grid is meant to mirror the profile, and the board cannot:
the order a person planned and the order Instagram publishes in diverge as soon as one post is
late, retried or rescheduled, and a local copy has no way to know the real order.

## Decision

**Once a post is published, its cell is removed from the board. The post is shown only as the copy
the provider returns in its list of published posts, in the order that list gives.**

- **The provider's list is the only source** of what is published and in what order. The board
  never draws, orders or stores a published post.
- **The status sync removes the cell** (a single image, an album or a video) and its entry in
  `board.posts` when it learns the post is published. It first refreshes the published list, so the
  provider's copy is drawn in the same render that the cell goes. The notice with a link to the
  post is unchanged.
- **Boards that already hold published cells are cleaned by the same sync, not by a storage
  migration.** The stored shape does not change, so there is nothing to convert. A migration
  would run on load with no network, and would delete a cell before its copy could be shown,
  or for good for someone who has since removed their key, leaving nothing in its place. The sync
  removes a published cell only once the provider's list has been read again, so a post never
  disappears without its replacement. Until a key is connected, a stale cell stays as it was.
- **Removal is not an undo step,** like the rest of the status sync (ADR-0018). The cell and its
  images are also removed from every stored step of the history ([ADR-0014](0014-stored-undo-history.md)),
  so undo and redo can never bring one back, and no step points at a cell that is gone.
  Steps that become the same as their neighbour are merged.
- **The images are treated as any removed cell's.** Once no step reaches them they are purged from
  the device store. On a folder board ([ADR-0015](0015-folder-board.md)) the file stays in the
  folder and its path is recorded, so it is not offered again, as
  [ADR-0020](0020-delete-removed-photos-on-request.md) describes.
- **The provider's copy is never hidden for a board cell.** The check that left out a published
  post that a cell already showed goes, except for a cell the sync has not yet removed, so nothing
  shows twice for the moment between the two.

## Consequences

- ADR-0023, and ADR-0018's "a cell whose own post has been published is shown once, as that cell", are superseded:
  it is shown once, as the provider's copy. The rest of ADR-0018 holds.
- The local image of a published cell is no longer on the board, and a published post's picture is
  the one Instagram serves.
- With no connection, only what the provider's list last cached shows as published, and a board
  with a key that has never loaded the list shows none. A published post older than the provider
  reads is not shown.
- A cell stays among the planned ones until the sync sees it published, up to a minute after it
  goes out. If the list cannot be read, the cell stays until it can.
- A person cannot undo a post going out, which was already true of the post.
- `publishedAt` in `board.posts`, `plannedCells` and `publishedCells`, which ADR-0023 introduced, are removed.
