# ADR-0023: A published cell leaves the plan and joins the published posts

- **Status:** Superseded by [ADR-0024](0024-published-cells-leave-the-board.md): a published cell leaves the board
- **Date:** 2026-11-15

## Context

[ADR-0018](0018-posts-on-the-board.md) kept a cell whose post had gone out where it was planned,
locked, and showed the provider's other published posts after the grid. The result misled: a post
published today sat at the top left, above cells still to come, although Instagram shows it
after them, among the posts already out. The Grid is meant to mirror the profile, so the order on
screen has to be the order on Instagram: what is yet to go out first, in the person's order, then
everything published, newest first.

The board must still draw its published cells with no connection, so the time a post went out has
to be kept with it.

## Decision

- **Storage does not move.** A published cell stays in `board.grid` and in `board.posts`, at the
  place it was planned. Freeing it, or a post cancelled before it went out, therefore never
  scrambles the other cells, and undo, redo, backups and the history are untouched.
- **It is drawn among the published posts.** The planned list is the grid without cells whose post
  is `published`. The published section merges those cells with the provider's published posts,
  newest first by `publishedAt`. A board cell goes before the first provider post that is older;
  a provider post with no time counts as the oldest. Normally that makes it the first published
  place, straight after the planned cells.
- **It shows once.** The provider's copy of a cell's own post is still left out (ADR-0018, by id or
  url), so the cell is the only one drawn, with its own picture.
- **It keeps what a locked cell has:** it cannot be dragged, grouped, sorted or deleted, and has the
  same actions (view the post, free the cell). The tab stop and position numbers follow the order
  drawn. The phone preview uses the same order.
- **`board.posts` stores `publishedAt`,** an optional ISO time written by the status sync from the
  provider's published list, matched by id or url, and kept once known. Without it the cell is placed
  by `scheduledFor`, so a board saved before this change, or a post the provider no longer lists,
  still draws sensibly. The field is optional, so no storage migration is needed.
- **With no connection or key** the section holds the board's published cells alone, ordered by their
  stored time. The check on a time against its neighbours (`outOfOrder`) ignores published cells.

## Consequences

- A cell's position number while published differs from its index in `board.grid`. Nothing may
  assume the two are equal; use `plannedCells` and `publishedCells`.
- A cell shows among the planned ones until the status sync sees it published, up to a minute after
  it goes out, then moves.
- Sorting and shuffling still work on the stored grid, and a published cell holds its stored index,
  which no longer shows. This is invisible, because every planned cell keeps its relative order.
