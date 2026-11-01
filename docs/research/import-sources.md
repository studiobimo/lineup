# Research: import sources beyond the file picker

Date: 2026-10-09, revised 2026-10-31. Background for stories IMP-8 and IMP-9 in the [PRD](../PRD.md) and for the
Google Photos entry under "Later" in the [roadmap](../ROADMAP.md).

Items marked **unverified** were not confirmed against a primary source in this research.

## Summary

| Source | Decision | Milestone |
| --- | --- | --- |
| Folder, one-off (picker or drop) | Build | M1 |
| A board kept in a folder | Build as an option where supported | M2 |
| Google Photos | Build later, as a picker import | After 1.0 |

All of them are extra ways in beside the file picker, not replacements. The import pipeline
takes images from a generic source, so each one is a small adapter in front of the same worker.

## Local folder

**One-off import.** A folder chosen with a directory file input, or dropped on the window, can
be read in every desktop browser. It is a small extension of the M1 import work.

**A board kept in a folder.** Remembering a folder and using it later needs the File System Access
API's directory picker. web.dev lists it as Chrome and Edge from version 86, with no support in
Safari or Firefox. Mobile support is **unverified**; treat it as desktop Chromium only.

Design choices:

- **A dedicated folder.** The app copies originals into a folder it owns, beside its own data, and
  does not reference files scattered elsewhere. See [ADR-0002](../adr/0002-local-first-storage.md).
- **Re-scan on request.** On a later visit the app offers to import what is new. It skips files
  already imported, matched by path, size and modified time.
- **Permission.** The stored folder handle may need permission again in a later session. From
  version 122 Chrome can offer to keep it. A refusal loses nothing, but the board cannot be read
  until access is granted.
- **Feature detection.** The option is hidden where the picker does not exist.

## Google Photos

Google removed whole-library access for third-party apps on 31 March 2025: the read scopes of
the Library API are gone, and an app can reach only media it created. An app can no longer
browse or sync a user's library or albums.

What remains is the **Picker API** (launched 16 September 2024):

1. The app gets an OAuth token with the `photospicker.mediaitems.readonly` scope.
2. It creates a session, which returns a `pickerUri`.
3. The user opens that URI in a new tab (it cannot be framed) and selects photos in Google's own picker.
4. The app polls the session until `mediaItemsSet` is true, lists the selected items, and
   downloads each through its `baseUrl`.
5. The app deletes the session.

What that means for Lineup:

- It is a manual pick each time. There is no "watch this album" and no automatic sync.
- The Google sign-in can be held in the browser, so it needs no server of ours.
- It needs a Google Cloud project and an OAuth consent screen. Whether the scope requires
  Google's app verification before public use is **unverified**.
- Whether the browser can download from `baseUrl` directly is **unverified**. If it cannot, the
  Worker would relay the bytes: images would pass through our server in transit, not be stored,
  and the privacy policy would have to say so. That would be the first exception to "the
  planner sends nothing to a server", so it needs an ADR.
- Its main value is on phones, where it removes the download-then-upload step.

A short spike before scheduling the work should settle the two unverified points.

## Sources

- <https://developers.googleblog.com/google-photos-picker-api-launch-and-library-api-updates/>
- <https://developers.google.com/photos/picker/guides/sessions>
- <https://developers.google.com/photos/picker/reference/rest/v1/sessions>
- <https://web.dev/articles/files/open-a-directory>
- <https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api>
