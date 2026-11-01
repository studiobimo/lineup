# ADR-0011: Drag with dnd kit's core package

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Arranging needs a pointer drag (ARR-2 to ARR-4), a long-press drag on touch with scrolling at the
edges (ARR-5), and a keyboard drag that a screen reader follows (ARR-6). Those last two are what
make a drag library worth having. The prototype used `@dnd-kit/core`.

Measured on 1 November 2026, bundled and gzipped, for what we would import:

| Package | Version | Size | Note |
| --- | --- | --- | --- |
| `@dnd-kit/core` | 6.3.1 | 13.9 KiB | Stable. No release since December 2024 |
| `@dnd-kit/react` | 0.5.3 | 34.0 KiB | The rewrite, in active development, before 1.0 |

The bundle budget had 13.2 KiB left when this was written.

## Decision

Use **`@dnd-kit/core`**, without `@dnd-kit/sortable`. A cell swaps or inserts on drop, and nothing
reflows during a drag, so sortable's live reordering has no job here.

The library supplies the sensors, the overlay, scrolling at the edges and the live region. We
supply the hit test: each move asks `document.elementFromPoint` what is under the pointer, because
rectangles measured in advance go stale beside a sticky tray and count cells it has clipped.

## Consequences

- A release could stop coming, so the use of it stays in `board-drag.tsx` and `use-board-drag.ts`, and
  `drag-target.ts` knows nothing about the library. Moving to the rewrite later means changing
  those two.
- Where a cell lands is a pure function, so it is tested without a browser.
- The overlay must not take pointer events, or the hit test would only ever find the overlay.
