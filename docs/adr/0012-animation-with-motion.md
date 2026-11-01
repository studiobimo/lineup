# ADR-0012: Animate arranging with Motion

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Dragging is the product's main interaction, and the first build of it felt worse than the prototype
because nothing moved except the pointer: cells jumped to their new places. The prototype used
Framer Motion, now `motion`. Arranging asks for a ghost on the pointer, and for every moved cell to
glide to its place, between the tray and the grid too (ARR-15).

Measured on 1 November 2026, bundled and gzipped, for `motion` 14.9:

| Part | Size |
| --- | --- |
| `LazyMotion`, `m`, `MotionConfig` | 6.5 KiB |
| `domAnimation`, without layout animation | 27.0 KiB |
| `domMax`, with layout animation | 41.4 KiB |

## Decision

Use **`motion`** through `LazyMotion` with `domMax`, loaded after first paint, because layout
animation is what glides a cell to wherever the grid puts it, and writing that by hand would mean
owning measuring, scroll correction and interruption.

- `strict` stops anyone importing the full `motion` component by accident.
- `MotionConfig reducedMotion="user"` respects the system setting, and Playwright runs with it, so
  a real mouse is not chasing a moving cell. `arranging-motion.spec.ts` turns it back off to check
  the animation itself.
- One ghost carries a drag from pick-up to landing, in place of dnd kit's `DragOverlay`, so nothing
  is handed over at the moment of a drop. This replaces the overlay in
  [ADR-0011](0011-drag-with-dnd-kit.md). It sits at the pointer plus an offset, and the offset does
  the lifting and landing, so its lean comes from the pointer's speed and nothing else.
- Physical moves are springs, because a tween cannot be interrupted smoothly.
- A cell that glides is raised above its neighbours: siblings paint in page order, so one moving
  back through the order would otherwise slide under them.
- A cell changing container flies in a fixed layer instead of using `layoutId`, because the tray
  scrolls and so clips anything inside it.
- `AnimatePresence` is not used on cells. It keeps a removed cell mounted, which would register one
  id twice with the drag library, and its `popLayout` mode injects a style tag that the content
  security policy refuses.

## Consequences

- The bundle check's total goes from 215 KiB to 290 KiB. That number is ours, not the PRD's: the
  PRD's limit is JavaScript before any lazy route, which this does not touch.
- Every cell is a motion component, so the cost of a layout pass grows with the board. It is
  limited with `layoutDependency`, and a 300-image board has to stay at 60 fps on a mid-range phone.
