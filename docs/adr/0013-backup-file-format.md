# ADR-0013: A backup is one file of our own format

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

ARR-13 asks for one action that saves a board to a single file, which restores exactly on any
device. A board is local-first ([ADR-0002](0002-local-first-storage.md)), so a browser's storage
being cleared would otherwise lose it for good. Three hundred images make a file of several hundred
megabytes, and image bytes stay out of application memory.

A ZIP would open anywhere, which is worth something. But it needs a checksum of every byte, so each
image is read into memory to make one, and a library to do it, and common ones stop at 4 GB.

## Decision

**A `.lineup` file is a small header, a JSON manifest, and the image bytes.**

| Bytes       | Holds                                                                |
| ----------- | -------------------------------------------------------------------- |
| 8           | The signature `LINEUPBK`, in ASCII                                   |
| 4           | The manifest's length in bytes, a little-endian unsigned integer     |
| That length | The manifest, as UTF-8 JSON                                          |
| The rest    | Every image's thumbnail and publish copy, one after another, as JPEG |

The manifest is `{ version, board, images }`. `board` is the stored board. Each entry of `images`
is the stored image record plus `thumbnail` and `publish`, each an `[offset, size]` pair counted
from where the bytes start.

- A backup is built as a Blob of Blobs, and read with `slice`, so neither direction loads an image.
- It holds what is on the board. The undo history does not travel, nor what only it could restore.
- Reading validates the manifest and refuses a file that is cut short, because it is untrusted.
- Restoring is a step in the history, so Undo brings back the board it replaced.
- A format change raises `version`, and a release goes on reading every older version.

## Consequences

- There is no dependency, and no limit on size but the browser's.
- Nothing but Lineup opens a backup. People cannot pull their images out with a file manager, and a
  later export can offer that if anyone asks for it.
- The file holds capture dates and cities where the board has them, so it is as personal as the
  board. It stays wherever the person saves it.
