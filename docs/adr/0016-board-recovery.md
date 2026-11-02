# ADR-0016: A board survives a tab closing mid-write

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

A store's writes are asynchronous, and a closing tab does not wait for them. The folder store makes
the gap wider than IndexedDB does, because a write there is a file swapped into place. A step taken
just before a tab closed could be lost, which [ADR-0014](0014-stored-undo-history.md) accepted.

An interrupted import left a second gap. Images are stored before they join the board, so images
stored by a tab that then closed were reachable from nothing, and the next load purged them. In a
folder board that also marked their originals as removed, so they were never offered again.

## Decision

**The board is journalled synchronously, and a load puts back whatever it finds unfinished.**

- Every board change is written to `localStorage` before its save starts, and cleared when the last
  save under way has finished. `localStorage` is synchronous, so the change is safe by the time it
  is on screen. A board is only ids, so this costs little, and the journal holds no image.
- A load that finds a journal which differs from the stored board applies it as one step, which can
  be undone. A journal naming an image the store does not hold belongs to another board, and is
  dropped.
- A load no longer purges. An image on no board and no step goes to the tray, as one step, which
  replaces that line of ADR-0014. This also rebuilds a board whose own record was lost.
- A failed save keeps its journal, and is retried every five seconds and on the next change, so a
  full disk or a drive plugged back in recovers without a reload.
- An import that fails part of the way keeps the images that were stored.

No prompt asks people to stay on the page. The journal makes the wait unnecessary.

## Consequences

- If the delete of a purged image fails, that image returns to the tray on the next load. An image
  someone removed coming back is better than one they did not remove going away.
- The journal lives in one browser, so a folder opened from another browser cannot see it.
- Several steps queued behind one write come back as a single step.
- History is not journalled, because it is up to 590 KB, so a recovered board carries the history
  of the last save that finished.
