# ADR-0021: Decode HEIC in the import worker with libheif

- **Status:** Accepted
- **Date:** 2026-11-07

## Context

HEIC is the iPhone's default photo format. The planner accepts `.heic` and `.heif` files, but the
import worker decodes with `createImageBitmap`, which only Safari can do for HEIC. In Chrome, Edge
and Firefox every HEIC was dropped as "could not be read" (issue 210). IMP-4 promises that any
image the browser can decode is accepted, and HEIC is the one most people actually have.

Four ways to fix it were weighed:

- **A conversion API.** It would send unpublished photos to a third party before the user has
  chosen to schedule anything, which [ADR-0002](0002-local-first-storage.md) and the local-first
  rule forbid. The content security policy would also block it.
- **Asking people to convert first.** It leaves the bug in place and moves the work to the user.
- **The browser's own decoder through WebCodecs.** Support depends on codecs that the platform
  provides, so it cannot be relied on.
- **A WebAssembly decoder in the worker.** Local, the same in every browser.

Every HEIC decoder on npm (`libheif-js`, `heic-decode`, `heic2any`, `@saschazar/wasm-heif`) is
libheif compiled to WebAssembly. The wrappers that say ISC or MIT only wrap it: the code that does
the work is libheif, and libheif is **LGPL-3.0**. No permissive HEIC decoder exists in JavaScript.
This repository is proprietary, so this is a licensing decision, not only a technical one.

## Decision

- Decode with **`libheif-js`** (libheif 1.x, LGPL-3.0), only when `createImageBitmap` fails and the
  file's `ftyp` box names a HEIF brand. A browser that decodes HEIC itself never loads it, and
  neither does a corrupt JPEG.
- It is loaded lazily, in the import worker only. The decoder is its own chunk, and its
  `libheif.wasm` is a separate file served from our own origin, unmodified. It is not inlined into
  application code, so it stays a replaceable library, which is what the LGPL asks of a program
  that links it. Nothing is added to the first load.
- The import worker's script gets its own policy, with **`'wasm-unsafe-eval'`** in `script-src`,
  which compiles WebAssembly and does not permit `eval()` of text. A dedicated worker takes its
  policy from its script's response, not from the page, so the pages' policy does not change, and
  nothing is fetched from another origin.
- The publish and thumbnail copies stay JPEG, made by the same pipeline from the decoded pixels.
  libheif applies the photo's rotation as it decodes.
- Capture dates and locations are read from the original file, as for any other photo. exifr's
  small build reads JPEG only, so a HEIC file gets its `lite` build, set to answer in the same
  terms as the small one.
- The privacy page credits libheif and its licence, as it does for GeoNames.

## Consequences

- HEIC imports in every browser. Nothing leaves the device.
- Importing the first HEIC that a browser cannot read downloads about 1.4 MB of WebAssembly (0.5 MB
  gzipped) and compiles it. The `.wasm` file is left out of the service worker's precache, so only
  people with such photos pay for it.
- A decoded 12-megapixel photo is about 48 MB of pixels while it is resized, as before for a
  JPEG of the same size: one image at a time holds.
- The app depends on an LGPL library. Changing how it is loaded (inlining it into the app's own
  bundle, or modifying it) needs a new decision here. If its terms ever stop being acceptable, the
  fallback is a clear "convert to JPEG first" message for HEIC in browsers that cannot decode it.
- Only the import worker may compile WebAssembly. Its rule in `_headers` matches the worker's
  file name, so renaming the worker needs the rule renamed too, and the browser test of a HEIC
  import fails if they part.
- A HEIC file holding several images imports its first.
