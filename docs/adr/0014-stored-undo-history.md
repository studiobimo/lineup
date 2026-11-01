# ADR-0014: The undo history is stored with the board

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

HIS-5 asks for undo to survive a reload. Until now the history lived in memory, so a reload lost it,
and [ADR-0002](0002-local-first-storage.md) purged whatever the board alone did not reach.
[ADR-0010](0010-one-active-tab.md) has a tab that takes over start with an empty history, and this
replaces that one detail of it.

A step is a whole board. Fifty steps of 300 cells make about 590 KB to write on every change, so it
was measured first: 0.7 ms at the median in Chromium, and 2.6 ms at worst, on a laptop.

## Decision

**The last 50 steps are stored in their own object store, and written on every change.**

- The history is a store of its own, so loading a board never pays for it, and it needs a migration.
- A tab that takes over reads the stored history, so nothing is lost by moving between tabs.
- An image stays until no stored step reaches it. Purging on load now counts the stored history.

## Consequences

- Deleting images frees no space until their step leaves the 50, however long that takes. Clearing
  a board of 300 images can hold several hundred megabytes until 50 more changes have been made.
  The cap is on steps and not bytes because that is what people can reason about, and this can be
  revisited if storage pressure turns out to matter.
- A step taken just before a tab closes can miss its write, as a board change always could.
