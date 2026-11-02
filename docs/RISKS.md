# Risks and assumptions

Reviewed at the start of each milestone. A risk is closed by linking the change or ADR that settled it.
Open questions are not listed here: each one is an issue, in the milestone that needs the answer.

## Risks

| # | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| 1 | Zernio may return only posts created through it, not the account's existing posts | ZRN-6 shrinks; the "plan against the real feed" promise weakens for new users | Zernio documents reading external posts, about 12 months back ([spike](research/instagram-apis.md#4-m4-spike-results)), and ZRN-6 is built on that | Open until seen on a real account: the owner's key has none connected |
| 2 | Zernio changes pricing, terms or its API; it was renamed from Late in 2026 and one reviewer reports a steep price rise | Users lose scheduling, or it stops being free for one account | Provider interface in the Worker ([ADR-0003](adr/0003-zernio-byok.md)); Post for Me and native Meta documented as replacements | Open |
| 3 | Pasting an API key, and doing it again every 30 days, is too much friction for non-technical users | Few people reach scheduling, or they lapse | Step-by-step guide (ZRN-4); the planner is valuable without it; native Meta provider is the long-term answer | Accepted for v1 |
| 4 | A Zernio key is a high-value secret: it can post to the user's account | Account takeover of someone's Instagram presence if leaked | Narrowed to one profile and 30 days where Zernio allows it; sealed with AES-GCM under a versioned Worker secret; kept in an HttpOnly cookie; stored on no server; never logged; tests assert it appears in no response ([ADR-0008](adr/0008-sealed-provider-key.md)) | Open |
| 5 | The org profiles are new, have not been used in a workspace, and Lineup is their first full app | Bugs or gaps surface here first | Fix them in `studiobimo/project-template`, not locally ([ADR-0007](adr/0007-web-and-cloudflare-profiles.md)) | Open |
| 6 | coss ui is newer than shadcn/Radix and lacks a Carousel | Missing parts must be built; upstream may change | Components are copied into the repo, so there is no runtime dependency on the registry; gaps are small ([ADR-0007](adr/0007-web-and-cloudflare-profiles.md)) | Accepted |
| 7 | Browser storage can be evicted, especially on iOS Safari, and quotas vary | A user's board disappears | Request persistent storage; show usage; explain storage-full; keep thumbnails small. App install (SHL-9) and backup to a file (ARR-13) are the v1 answer; cloud sync is the real fix and is out of scope | Open |
| 8 | Touch drag-and-drop inside a scrolling grid is hard to get right | The main mobile goal fails | Long-press activation, edge auto-scroll, a Playwright touch test, and real-device passes in M1 exit criteria | Open |
| 9 | Scheduled times can contradict grid order | The published feed does not match the plan | ZRN-9 warning; decide warn versus block before M5 | Open |
| 10 | Mail scanners open sign-in links | Tokens are consumed before the user clicks | None needed | Closed by [ADR-0008](adr/0008-sealed-provider-key.md): no sign-in in v1 |
| 11 | Sign-in form abused to send mail or enumerate users | Reputation of the sending domain; privacy | None needed | Closed by [ADR-0008](adr/0008-sealed-provider-key.md): no sign-in in v1 |
| 12 | Private repository on the GitHub Free plan: no rulesets, and Actions minutes are metered | `main` is not protected by rules; CI cost | Hooks and the agent guard still enforce conventions locally; keep CI to one job; revisit when the repo goes public or the plan changes | Accepted |
| 13 | "Lineup" is a common word and has no trademark check | A clash, or weak findability | "Feed planner" carries the search value in the tagline and page title; do a trademark search before 1.0. Blueline and Mosaic are the alternatives if the name has to change | Open |
| 14 | Instagram changes its grid again, as it did in 2025 when it moved from square to 3:4 | The preview is wrong | Cell ratio, column count and carousel limit are one network profile; images are stored uncropped | Accepted |
| 15 | Deleted images kept for undo consume storage | Quota pressure | Cap persisted history at 50 steps; purge images when their step leaves the history | Open |
| 16 | A folder board works only in desktop Chrome and Edge, and the browser may ask for permission again | Users on Safari, Firefox or a phone never see the feature; others find it nagging | It is opt-in, and the browser store remains the default. A refused permission makes a board unreadable until it is granted, but loses nothing ([ADR-0002](adr/0002-local-first-storage.md)) | Accepted |
| 17 | A Worker has a compressed size limit and little CPU time per request | A dependency or a design choice makes the API fail or forces a paid plan | Size budget checked in CI, a no-polyfill dependency rule, CPU watched on staging, and no hashing or image work on the server ([ADR-0005](adr/0005-workspace-and-api-contract.md)) | Open |
| 18 | The board can use too much memory, as the prototype did | The tab slows or is killed on phones | Thumbnails in cells, windowing, cells that draw a bitmap and free it rather than holding an `<img>`, no image bytes in application state, and a budget in the PRD | Open |
| 19 | A provider's limits differ from Instagram's (Zernio documents 10 carousel items, Meta 20; Meta takes JPEG only) | A planned post cannot be scheduled as planned | The spike found Zernio documents 20 carousel items and feed ratios of 0.5625 to 1.91; the publish copy is always JPEG, and a post the provider fails shows its reason on the cell | Open until scheduled on a real account |
| 20 | Script on the page could use the API while the cookie is valid | Unwanted posts until the key expires | Strict CSP, no third-party scripts in production, no API reference page in production, and a restricted key limits what it can do | Open |

## Assumptions

| Assumption | If wrong |
| --- | --- |
| Users who want to schedule have, or will switch to, an Instagram professional account | Scheduling is unavailable to them; this is a platform rule for any provider |
| One board per browser is enough for v1 | Multiple boards moves up from "Later" |
| The Zernio free tier (two accounts, 60 requests a minute) stays | BYOK stops being free; see risk 2 |
| Cloudflare's free or lowest paid Workers tier covers the API | Sealing is cheap by design; revisit only if Zernio proxying adds CPU time |
| A full Zernio key can mint a restricted key, as its docs suggest | The user creates a narrow key in Zernio's dashboard, and our guide says how; expiry is then enforced by the seal alone |
| No analytics is acceptable for v1 | Add privacy-preserving, cookieless counting behind an ADR |
