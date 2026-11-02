# ADR-0017: An album is part of the board, not the images

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

[ADR-0002](0002-local-first-storage.md) says a cell is an image or an album. Every action that
treats a cell as one thing has to go on doing so with an album in it, and every change has to be
undoable, which works by keeping whole boards as snapshots.

## Decision

**A board has an optional map from a cell's id to the ids of its album's images, in order.**

```ts
interface Board {
  tray: string[]
  grid: string[]
  locked?: string[]
  albums?: Record<string, string[]>
}
```

- The tray and grid stay lists of cell ids, so moving, swapping, shuffling, locking and sorting do
  not change. An album's images are in no cell of their own.
- An album lives on the board and not in a store of its own, so every snapshot carries the albums
  it had, and undo needs no code of its own for them. Grouping, reordering and ungrouping are all
  ordinary board changes.
- An image record does not know about albums. An image stays stored for as long as any snapshot
  reaches it, through an album or not.
- The first image is the cover, and an album sorts as its cover, so a sort sees a cell with the
  cover's colour and the album's id.
- An album down to one image becomes that image, which also covers images lost from a store.

Being optional, the field needs no storage migration: a board with no `albums` is a board with no
albums. The backup format goes to version 2 all the same, and version 1 stays readable, because a
release that only knows version 1 would drop the albums without a word.

## Consequences

- A board's size and its cell count now differ, so anything that counts images counts through
  `imagesOn`, and the limit of 300 counts images, not cells.
- Code that takes a cell's id and wants an image has to resolve it first, with `coverOf` or
  `imagesOf`. Passing an album's id to the store finds nothing rather than something wrong.
