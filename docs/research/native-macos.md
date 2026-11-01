# Research: a native macOS app

Date: 2026-10-31. Background for [ADR-0009](../adr/0009-web-first-desktop-later.md). The question:
should this be a Swift app that keeps photos in a dedicated folder, instead of a browser app?

## Summary

There is a real argument, but memory is the weakest part of it. The strong arguments are real
files, access to the Photos library and on-device vision. The strong argument against is that one
of the two personas works from a phone. The recommendation is web first, with the storage layer
built so a desktop shell can be added when there is evidence for it.

## Memory

The prototype's memory use comes from how it holds images, not from running in a browser.

- `ImageItem.data` is a base64 string, and every image is read from IndexedDB into the store at
  startup (`store.getAll()` in `src/features/gallery/lib/storage.ts`).
- Each cell renders that 1200 px image, and the grid is not virtualised.

Worked out from those constants, not measured in a running browser:

| | Pixels | Decoded size | 300 images, all decoded | Only about 36 visible cells |
| --- | --- | --- | --- | --- |
| Prototype, full image in every cell | 1200 × 1500 | 7.2 MB | 2.2 GB | 259 MB |
| Plan, thumbnail in every cell | 480 × 640 | 1.2 MB | 369 MB | 44 MB |

Browsers drop decoded images they no longer need, so the 2.2 GB is a ceiling. The point stands for
either kind of app: a bitmap costs width × height × 4 bytes in a browser and in Swift alike. A
native app with full-size images in every cell would have the same problem, and a browser app with
thumbnails and windowing does not have it. The PRD now requires both.

The browser's own overhead is real but small here, and for most users the browser is open anyway.

## Where native wins

| Capability | Native | Web today |
| --- | --- | --- |
| A folder as the real store | Yes. Files stay visible in Finder, back up with Time Machine and open in Lightroom | Chrome and Edge can read and write a chosen folder. No Safari or Firefox support was found |
| Durability | Files are not evicted | IndexedDB can be evicted. Safari caps script-writable storage after seven days without use, except for installed web apps |
| Originals | Kept where they are | Kept in a folder board on Chrome and Edge; processed copies elsewhere |
| Size limits | Disk space | About 60% of the disk per origin in Chrome and Safari, and 10 GiB by default in Firefox, so quota is rarely the limit |
| Photos library | PhotoKit, with the user's permission | None. Google Photos is pick-by-hand ([import research](import-sources.md)) |
| Sorting by content | On-device Vision framework, no server and no model to ship | Would need a large model; [ADR-0004](../adr/0004-colour-autosort.md) rejected this for now |
| Storing the provider key | Keychain | A sealed HttpOnly cookie, which no script can read ([ADR-0008](../adr/0008-sealed-provider-key.md)) |

## Where native loses

- **The phone.** The social manager persona needs to "fix the order on a phone", and SHL-7 requires
  it. The established tools in this category (Preview, Planoly, UNUM) are phone apps. A Mac app
  serves one persona, on one operating system, at a desk.
- **Reach.** No Windows, no Android, and no link that lets someone try it in ten seconds.
- **Distribution.** The Apple Developer Program, notarisation, and either App Store review or our
  own update channel.
- **Org fit.** Every studio tool assumes the web or the JVM. There is no Swift profile in
  `project-template`, and macOS runners use Actions minutes at ten times the Linux rate, so the
  private Free plan's 2,000 minutes become about 200.
- **Rewrite cost.** Accessible drag and drop, a lightbox, onboarding and theming would all be
  rebuilt, and an iOS version still needs its own interface.

## The third option: a desktop shell over the web app

Tauri wraps the same React app in the system's WebKit view instead of shipping Chromium.

- It gets real folders, Keychain access and a small download. One October 2026 write-up measured a
  minimal app at 4.4 MB against 294 MB for Electron. Tauri 2 also targets iOS and Android.
- Memory is lower than Electron: one benchmark put six windows at about 172 MB against 409 MB. No
  source compared it directly with SwiftUI, and images still cost what the table above says.
- It costs a Rust toolchain, plus the same signing, notarisation and macOS CI as a Swift app.
- It reaches neither Photos nor Vision without writing native plugins.

## Recommendation

1. Build for the web, and fix memory with thumbnails and windowing.
2. Put every read and write of images behind a `BoardStore` interface, so the store can be swapped.
3. Add board backup to a file (ARR-13), which also becomes the way to move a board into any later
   app.
4. Add app install and offline use early (SHL-9). It gives a window of its own, and it is the
   documented way out of Safari's seven-day cap.
5. Build a folder-backed `BoardStore` for Chrome and Edge in M2. It is the cheapest test of whether
   people want this, and Tauri is next if it holds up.

Swift becomes the right answer in one case: if this is a paid Mac app for designers, and the
phone persona is dropped. That is a change of product, not of stack.

## Sources

- <https://web.dev/opfs>
- <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
- <https://bugs.webkit.org/show_bug.cgi?id=231706>
- <https://lists.webkit.org/pipermail/webkit-unassigned/2022-March/1025616.html>
- <https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833>
- <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- <https://dev.to/gethopp/tauri-vs-electron-performance-bundle-size-and-the-real-trade-offs-1el4>
- <https://www.issoh.co.jp/md/tech/4114>
- <https://alternativeto.net/software/preview-planner-for-instagram>
