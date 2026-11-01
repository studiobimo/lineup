# ADR-0009: Web first, and a desktop app only with evidence

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

A native macOS app would give the planner a real folder of photos, the Photos library and on-device
vision. It would also leave out the persona who works from a phone, as well as Windows, Android and
anyone arriving from a link. The trade-off is in the
[native research](../research/native-macos.md).

The prototype's high memory use does not bear on this choice: it came from holding full images as
base64 in memory, which the new design already avoids.

## Decision

Ship on the web, and keep the decision open cheaply.

- Storage sits behind the `BoardStore` interface ([ADR-0002](0002-local-first-storage.md)).
- A board can be **backed up to one file and restored** (ARR-13), in a documented format that any
  later app can read.
- The app is **installable and works offline** (SHL-9) from M2, not from launch.
- The **folder store in M2** is the first test of whether people want real folders. If they do, a
  Tauri shell is next. Either step beyond it needs its own ADR.
- A Swift app is considered only if the product becomes Mac-first, which means dropping the phone
  persona.

## Consequences

- The phone persona, and the plan as written, are unchanged.
- One thin interface and a backup format are added to M1 and M2.
- Safari users stay exposed to eviction until they install the app or take a backup. The interface
  has to say so.
