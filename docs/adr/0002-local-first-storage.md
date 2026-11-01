# ADR-0002: Local-first storage

- **Status:** Accepted
- **Date:** 2026-10-09, revised 2026-10-31

## Context

The planner's data is a few hundred images and their order. The prototype kept them in
IndexedDB as base64 text, compressed on the main thread, with undo held in memory for two
actions only. Its strength was that nothing was uploaded and no account was needed.

Storing users' images on our servers would add storage cost, quotas, upload handling, and deletion
and export duties.

Browser quota is not the constraint. Chrome, Edge and Safari allow an origin about 60% of the disk,
and Firefox 10 GiB by default. The real weaknesses of browser storage are that a board can be
evicted all at once, and that its files cannot be seen, opened or backed up outside the browser.

## Decision

The board lives **on the user's device**. The server never stores images or board order. All
persistence goes through a **`BoardStore` interface** with two implementations, and nothing outside
it knows where bytes live.

- **Browser store, the default everywhere.** IndexedDB through `idb`. Each image has a record with
  metadata (dimensions, dominant colour, created time) and two binary blobs: a thumbnail, and a
  publish copy, which is a JPEG up to 1440 px wide, never upscaled. Originals are not kept.
- **Folder store, opt-in on desktop Chrome and Edge.** The user chooses a dedicated folder through
  the File System Access API. Originals are copied there untouched, at any size, and the board
  keeps its own data beside them in `.lineup/`. A publish copy is made when a post is scheduled.
  The folder handle is kept in IndexedDB, and Chrome can keep the permission between visits. The
  option is hidden where the API does not exist.
- A board uses one store. Backup and restore (ARR-13) is how a board moves between them.
- A file removed outside the app shows as a missing cell, not an error.
- The board is an ordered list of cells per container. A cell is an image or an album.
- The schema is versioned from the first release and every change ships with a migration and a
  test that opens a board saved by the previous release.
- Importing runs in a Web Worker using `createImageBitmap` and `OffscreenCanvas`: decode, resize,
  encode, thumbnail and colour extraction in one pass, one image at a time.
- State is one zustand store per feature. History is a stack of board snapshots (ids only), so
  every action is undoable by construction. Deleted images are kept until their snapshot
  leaves the history, then purged.
- The app asks the browser for persistent storage and reports usage in Settings.
- Records use stable UUIDs and carry no assumption that they are local, so a later sync layer
  can be added without rewriting the model.

## Consequences

- The planner works with no account and offline, and the privacy story is simple.
- A folder board keeps full-size originals, which sit outside the browser's quota and eviction,
  stay visible in Finder and are covered by the user's own backups.
- The browser store could hold larger copies too, but it gains nothing yet: Instagram does not need
  more than the publish copy, and more data would only raise what eviction can lose.
- Safari, Firefox and phones get the browser store only.
- A board does not follow the user to another device or browser. Clearing site data loses a browser
  board, and only the folder's permission for a folder board. The interface must say so.
- Browser eviction is a real risk on some platforms (see RISKS.md, risk 7).
- A folder board cannot be read until the user grants access again, if the browser has dropped it.
- There are two stores to test, so the interface stays small.
- Images leave the device only when the user schedules a post, and then they go to the
  scheduling provider, not to our storage ([ADR-0003](0003-zernio-byok.md)).
