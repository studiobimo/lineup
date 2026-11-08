# ADR-0022: Plan and schedule videos as Reels

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

The PRD left video, Reels and Stories out of v1, and the roadmap kept video for later. Two problems
made that too narrow. A real profile grid is often half Reels, so a plan without them does not look
like the feed it is planning. And with a key connected, the account's own videos did not show:
Zernio gives a video's media item no thumbnail, so the cell fell back to the video's own URL,
loaded it as an image, and showed a broken picture.

The import pipeline assumes an image throughout. The worker decodes with `createImageBitmap`, which
cannot read a video, and a dedicated worker has no `<video>` element. The board keeps two JPEG
copies of each image and never its original ([ADR-0002](0002-local-first-storage.md)), and a video
cannot be re-encoded in the browser without a large codec library.

## Decision

- **A video is a cell like an image.** Its record says it is a video, with its type and length.
  Everything that moves, groups, sorts or undoes cells treats it the same way.
- **Its first frame is its picture.** The main thread loads the file into a `<video>` element and
  draws a frame from just after the start. That frame goes through the usual worker pipeline, so the
  thumbnail, the colour for autosort and the cell drawing are the same as for a photo. One video is
  open at a time, and its element and object URL are released before the next one.
- **The video itself is the publish copy.** It is kept as it is, because the browser cannot
  re-encode it. A folder board already keeps the original in the folder
  ([ADR-0015](0015-folder-board.md)), so it does not make a second copy: its publish copy is read
  from that file, and a video whose file has gone cannot be scheduled.
- **Instagram's formats only.** MP4 and MOV are accepted. Instagram takes no other, and a file the
  provider later refuses would only fail at scheduling time. The limits (300 MB, 15 minutes for a
  Reel, one video per carousel) live in the network profile, and scheduling checks them before
  anything is uploaded.
- **One video posts as a Reel.** Instagram posts every single video as a Reel, and shows it on the
  grid unless told not to. Lineup plans the grid, so it sends no option that would hide it. A video
  in an album goes into the carousel.
- **A published video shows its cover, or its first frame.** The provider's thumbnail if it has
  one; if not, a muted `<video>` that loads only its metadata and first frame. The content security
  policy gains `media-src` for the same hosts as `img-src`, and `blob:` for a planned video, which
  plays from the device. Nothing else.
- **The API grows without breaking.** An upload may be `video/mp4` or `video/quicktime`, a new post
  may say which of its media are videos, and a published post may say it is one. Clients of `v1`
  that send neither are unaffected.

## Consequences

- A video can take hundreds of megabytes of the browser's storage, where a photo takes about one.
  The storage meter in Settings already shows what the board uses.
- Videos are not decoded in the import worker, so the main thread does a little work per video. It
  only seeks and draws one frame, so a batch stays responsive.
- A backup holds each video in full, so a board with videos makes a large backup file.
- Stories, a cover chosen by hand and trimming stay out. Each needs its own decision.
