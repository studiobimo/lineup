# ADR-0015: What a folder board keeps, and where

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

IMP-9 is the folder store that [ADR-0002](0002-local-first-storage.md) set out: originals at full
size in a folder the user chooses, and the board's data beside them in `.lineup/`. Building it
settled what ADR-0002 left open, and changed one thing it said, that a publish copy is made when a
post is scheduled.

[ADR-0002](0002-local-first-storage.md) also keeps the interface small because there are two stores
to test. Making the copy later would need a second path through the import worker, a way to read an
original for the lightbox, and a backup that decodes up to 300 originals on the spot.

## Decision

**A folder board stores what a browser board stores, and the originals besides.**

```text
<folder>/                 the originals, under their own names and in their own subfolders
<folder>/.lineup/         board.json, history.json, images.json, forgotten.json
                          thumbnails/<id>.jpg, publish/<id>.jpg
```

- **Publish copies are made at import, as they are for a browser board.** This replaces that line
  of ADR-0002. The interface stays as it was, and the lightbox, backup and scheduling need no
  second path.
- **Lineup never changes or deletes a person's photo.** A name that is taken becomes `photo (2).jpg`.
  Removing an image from the board removes the app's copies from `.lineup/`, leaves the file, and
  adds its path to `forgotten.json`, so it is not offered again. Settings shows how many such files remain, and can offer them again.
- **A folder is read by name only.** A file counts as missing when its path is gone, and as back
  when the path returns. Files are not hashed, so a renamed file is one missing cell and one new
  file.
- **Choosing a folder with no board copies the current board into it, history included,** and the
  browser board stays as it was. A browser board has no originals, so its publish copies become the
  files, named by id. ADR-0002 has backup and restore move a board between stores, and that still
  works, but choosing a folder should not start by losing the board on screen. A folder that has a
  board opens that board.
- **The handle has its own small database,** `lineup-folder`, because it says where the board is and
  is no part of it.
- **The code that opens a folder loads on its own,** and only where the browser has the API, so it
  costs Safari, Firefox and phones nothing.

## Consequences

- The folder holds a thumbnail and a publish copy of every image as well as its original.
- A board moved to another computer needs its folder and nothing else, but that folder cannot be
  reached from Safari, Firefox or a phone.
- Lineup keeps file names in a folder board, which a browser board does not. They stay on the
  device, and a backup leaves them out, so the privacy policy says so.
- A person can see and delete `.lineup/`. A board then starts again in that folder, and every photo
  in it is offered as new.
