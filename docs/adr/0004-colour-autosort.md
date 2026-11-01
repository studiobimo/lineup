# ADR-0004: Colour autosort from a dominant colour in OKLCH

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Sorting images by colour has two parts: reduce each image to a colour, then order the colours
in a way that looks right.

The first proposal was the average colour of each image (`fast-average-color`), converted to
HSL (`chroma-js`) and sorted by hue then lightness. It has known weaknesses:

- The average of a photograph is usually a muddy grey-brown that matches nothing in it.
- HSL lightness is not perceptual: a yellow and a blue with the same value look far apart.
- Hue is undefined for greys, so black, white and grey images land at an arbitrary place.
- Extracting on demand makes the sort slow and needs a canvas on the main thread.

Lineup's images are local, so cross-origin canvas restrictions do not apply.

## Decision

Compute a **dominant colour at import** and sort with a **pure function in OKLCH**. No colour libraries.

- **Extraction.** The image worker already holds the decoded bitmap. It downsamples to about
  32 px, converts pixels to OKLab, clusters them (k-means, k between 3 and 5, fixed seed), and
  takes the cluster with the highest weight of size and chroma. The record stores lightness,
  chroma and hue for that colour, plus the small palette. Images stored before this feature are
  backfilled in the background.
- **Sorting.** `sortByColour(cells, strategy)` returns an order and has no side effects.
  - *Rainbow*: by hue. Cells below a chroma threshold count as neutral and go last, by lightness.
  - *Light to dark*: by lightness.
  - *Grouped*: hue families, each by lightness, neutrals last.
  - Ties break on the cell id, so the result is always the same.
- **Behaviour.** One action, one undo step, available in the tray and the grid. It is not a
  mode: manual order is free again at once. An album sorts by its cover. Published cells stay put.

## Alternatives considered

**A server-side sorting service (Google Cloud Run).** Rejected.

- The work is tiny: about a thousand pixels clustered once per image, and a sort of at most 300
  stored colours. Both take milliseconds in the browser.
- A server can only sort what it receives, so every image would have to be uploaded. That breaks
  the local-first rule in [ADR-0002](0002-local-first-storage.md) and the promise that the
  planner works with no account.
- It would add a second cloud beside Cloudflare: billing, deploys, cold starts, and
  authentication between the two.
- It would be slower, because uploading the images takes far longer than computing their colours.

Reopen this only for sorting by what is *in* a photo, which needs a large vision model. Even
then, try Workers AI first so everything stays on one platform, and make it opt-in. Because the
sort is a pure function over stored values, moving it would not be a rewrite.

## Consequences

- Sorting is instant, because the colours are already stored.
- No dependencies: the conversion and clustering are about a hundred lines, covered by fixture
  tests that pin the expected order.
- The neutral threshold and the size-versus-chroma weighting are judgement calls. They are
  named constants, tuned against a fixed set of sample images.
- Layouts that use the grid's columns (gradients, bands, checkerboard) can be added later as
  further strategies on the same stored colours.
