# ADR-0020: A removed photo can be deleted from the folder, when the person asks

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

[ADR-0015](0015-folder-board.md) says Lineup never changes or deletes a person's photo. Removing an
image from the board leaves its file in the folder and records the path in `forgotten.json`, so it
is not offered again. Settings counts those files and can offer them again, and that is all it can
do. A person who wants one gone has to find it in their file manager, and Lineup cannot tell them
which ones they are.

## Decision

**Lineup deletes a photo from the folder only when the person asks for exactly that.**

- Settings shows, beside the count of removed photos, **Remove completely**, next to **Offer again**.
  It asks first, says how many photos and from which folder, and says they are deleted from the
  device and not moved to the bin.
- It deletes the files whose paths are in `forgotten.json`, and nothing else. Hidden files, the
  app's own `.lineup/` copies and every photo still on the board are never touched.
- Everything else in ADR-0015 holds: Lineup adds to the folder, never overwrites or renames a
  photo, and never deletes one for any other reason. Removing an image from the board still leaves
  its file.

## Consequences

- This is the one place Lineup deletes something a person put there, and it cannot be undone. The
  confirmation is the only guard, so its wording is part of the decision.
- ADR-0015's sentence "never changes or deletes a person's photo" now reads "never changes a photo,
  and deletes one only through Remove completely".
- The privacy policy needs no change, because nothing leaves the device.
