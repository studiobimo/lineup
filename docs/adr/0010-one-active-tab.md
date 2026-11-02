# ADR-0010: One tab at a time changes a board

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

A board can be open in two tabs of one browser, and both reach the same IndexedDB. Each saves the
whole board, so the last write would win and the other tab's work would be lost.

It would lose images too, not just order. [ADR-0002](0002-local-first-storage.md) keeps a deleted
image until no snapshot in the history can bring it back, and on load the app purges whatever the
board does not reach. A second tab has neither the first tab's history nor sight of an image the
first has stored but not yet placed, so opening it would delete both for good.

Merging cannot solve this: a purge is only safe if it knows every tab's history.

## Decision

**One tab at a time holds the board**, through the Web Locks API, and only that tab writes or
purges.

- A tab that finds the board taken shows no board. It says the board is open in another tab and
  offers to use it here.
- Using it here steals the lock. The other tab stops writing at once, even during an import, and
  offers the same choice.
- A tab that is waiting takes over by itself when the holder closes, because the browser releases
  the lock with the tab. It then reads the board from the store, with an empty history.
- Where the API does not exist the tab goes ahead alone. Every browser the PRD supports has it.

## Consequences

- There is nothing to merge, and the undo and purge rules in ADR-0002 hold as written.
- A second tab cannot be used to look at a board while the first edits it.
- A tab frozen on a phone keeps the lock, which is why taking over never waits for it.
- Undo history stays with the tab that made it: taking over starts with none. HIS-5 changes that
  when the history persists, and has to keep to this rule.
