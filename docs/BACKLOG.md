# Backlog

The first set of GitHub milestones and issues, in working order. This file is a seed, not a tracker:
`.devtools/scripts/seed-backlog.py` creates everything here, and then this file and that script are
deleted, because the issues are the source of truth from then on.

Each `##` is a milestone, and its text is the milestone's description. Each `###` is an issue title.
`Labels:` is optional. The rest of each entry is the issue body.

## M0: Foundation

Learn what Zernio can do, then deploy an empty app to staging.

### docs(provider): answer the zernio spike questions

Labels: spike

Stories: ZRN-6. With a free key and a test professional account, record in
`docs/research/instagram-apis.md`:

- [ ] Are posts made outside Zernio returned?
- [ ] Can a full key mint a restricted key through `POST /v1/api-keys`, on the free plan? (ADR-0008)
- [ ] Which `disabledResourceGroups` still allow listing posts, uploading and publishing?
- [ ] Can Zernio's dashboard create the same key, for the fallback?
- [ ] Can a key be revoked through the API, or only in the dashboard?
- [ ] Does `@zernio/node` run on Workers, or do we call REST with generated types?
- [ ] Which media upload path is current, and which account type is required?
- [ ] What is the carousel limit: Zernio's documented 10, or Meta's 20?
- [ ] Is a 3:4 image accepted, or must it be 4:5?

### chore(devtools): adopt the web and cloudflare template profiles

Add `.template-profiles`, set the app directory to `apps/web`, and run `make -C .devtools sync`,
which also brings the issue-title workflow once the template has released it. Then `include vite.mk`
from `.devtools/Makefile`.

Done when `make -C .devtools drift` reports nothing unexpected. Needs the template's workspace
support released (`studiobimo/project-template#35`).

### ci: apply org settings

Run `make -C .devtools github`.

### build: scaffold the workspace and app shell with coss ui

Create the pnpm workspace with `apps/web`, `packages/api` and `packages/contract`. Run `gen.mjs app`
for `apps/web`, then `shadcn init @coss/style` there. Add the theme tokens and an app shell in light
and dark. Set the bundle budget in `.devtools/Makefile` to the PRD's first-load target. This is more
than 20 files, so it goes up as a stack.

Done when `make -C .devtools check` passes locally and in CI.

### feat(api): serve versioned routes from the worker

Hono in `packages/api`, mounted by the Worker entry at `/api/v1`, plus `/api/health`, a JSON 404
under `/api/`, and problem-details errors, as in `docs/API.md`. Schemas are in `packages/contract`,
and the web app calls the API through Hono's typed client.

### feat(api): generate the api reference from the routes

`hono-openapi` on every route, and `generateSpecs` in a build step, as in `docs/API.md`. Validation
errors must keep the problem-details shape, not the library's default. State the size added to the
Worker, and fall back to `@hono/zod-openapi` if it is too large or breaks the typed client.

Done when the check fails on a stale document, and the reference shows on staging but not production.

### build: send a strict content security policy

For the app, static assets and API alike. `connect-src` allows our origin and the provider's upload
host only. Stories: none, but ZRN-2 depends on it.

### test(ui): add playwright with one smoke test

Installs Playwright, and runs one test against the built app in CI.

### build: deploy to staging with cf:deploy

Add `cf:deploy:staging` and `cf:deploy:production`, wrapping `make -C .devtools deploy ENV=<env>` so
the environment is fixed at build time, or link the repository in the Cloudflare dashboard. No
Cloudflare credential goes in GitHub.

Done when the shell is live on staging and release-please opens a release pull request.

## M1: Planner core

The first public release: import, arrange, preview and undo.

### feat(planner): process images in a worker

Stories: IMP-4, IMP-5, IMP-7. Decode, resize, and produce a thumbnail and a JPEG publish copy of up
to 1440 px wide, off the main thread.

### feat(planner): add the board store on indexeddb

Stories: ARR-12. A `BoardStore` interface with an IndexedDB implementation, versioned migrations
from the first release, and a persistent storage request. Image bytes never enter app state.

### feat(planner): add the board state with undo and redo

Stories: HIS-1, HIS-2, HIS-3, HIS-4. Snapshot history, with a test of undo and redo for every
action. Includes the Instagram network profile: columns, cell ratio, carousel limit.

### feat(planner): render the tray and grid from thumbnails

Stories: ARR-1. Off-screen cells hold no decoded image. Done when a 300-image board meets the PRD's
memory budget, measured and written in the PR.

### feat(planner): import from the picker, drop, paste and folders

Stories: IMP-1, IMP-2, IMP-3, IMP-6, IMP-8. Every path goes through one import-source interface.

### feat(planner): drag cells with a pointer

Stories: ARR-2, ARR-3, ARR-4.

### feat(planner): drag cells on touch

Stories: ARR-5. Includes the Playwright touch test. Check on a real phone before closing.

### feat(planner): arrange cells with the keyboard

Stories: ARR-6.

### feat(planner): add bulk move, shuffle, delete and clear

Stories: ARR-7, ARR-8, ARR-9, ARR-10.

### feat(ui): add the lightbox with zoom and pan

Stories: REV-1, REV-2.

### feat(ui): add the phone preview

Stories: REV-4.

### feat(ui): add onboarding, shortcuts and the theme setting

Stories: SHL-1, SHL-2, SHL-3.

### feat(ui): add empty, loading and error states

Stories: SHL-4, SHL-5.

### feat(ui): add the terms and privacy pages

Stories: SHL-6. They say exactly what is stored where.

### test(ui): pass the phone and accessibility checks

Stories: SHL-7. Every story so far works at 360 px with touch only, an axe scan of the main screen
is clean, and one iOS and one Android phone pass by hand.

### chore: deploy the planner to production

Done when `lineup.bimo.dev` is live and the M1 exit criteria are checked off in the release PR.

## M2: Autosort and durability

Sort by colour, and protect local boards.

### feat(autosort): extract a dominant colour at import

Stories: SRT-6. In the image worker, with a background backfill for stored images (ADR-0004).

### feat(autosort): sort by colour with three strategies

Stories: SRT-2, SRT-3, SRT-8. A pure function, with fixture tests that pin the order.

### feat(autosort): add the sort menu

Stories: SRT-1, SRT-4, SRT-5.

### feat(planner): back up and restore a board

Stories: ARR-13. One documented file format, and a test that restores it exactly.

### feat(planner): keep undo history across reloads

Stories: HIS-5. Decide how many steps and deleted images can be kept before storage pressure
matters. The PRD assumes 50 steps.

### feat(ui): install as an app and work offline

Stories: SHL-9. Tell Safari users why installing protects their board.

### feat(planner): keep a board in a folder

Stories: IMP-9. A second `BoardStore` on the File System Access API, keeping originals at full size
(ADR-0002). Record how often people use it: it decides whether a desktop shell is worth building
(ADR-0009).

## M3: Albums

Several images planned as one post.

### feat(albums): model a cell as an image or an album

A storage migration, and a test that opens a board saved by the previous release.

### feat(planner): select several cells and act on them

Stories: ARR-11.

### feat(albums): group by selection and by dwelling on a cell

Stories: ALB-1, ALB-7.

### feat(albums): show, open and edit an album

Stories: ALB-2, ALB-3, ALB-4, ALB-5.

### feat(albums): carry albums through every action

Stories: ALB-6, SRT-7, REV-3. Includes history, sort, the lightbox and backup, each tested with an
album in the set.

## M4: Instagram through Zernio

See what is live and schedule what is next.

### feat(provider): seal the provider key in a cookie

Stories: ZRN-1, ZRN-2, ZRN-3, ZRN-14. Narrow, seal, cookie and expiry, as in ADR-0008. Tests prove
the key appears in no response, log or stored value, and that an expired or altered cookie is
refused.

### feat(provider): add the provider interface with zernio

List accounts and posts, request an upload, schedule, update and cancel, on a fixed list of routes
and never a generic proxy. Uses neutral names outside the Zernio implementation.

### feat(provider): guide key setup and choose an account

Stories: ZRN-4, ZRN-5.

### feat(provider): show published posts as locked cells

Stories: ZRN-6, REV-5.

### feat(provider): schedule an image or a carousel

Stories: ZRN-7, ZRN-8, ZRN-9, ZRN-12, ZRN-13. Decide whether times that contradict grid order warn
or block. Update the privacy policy and terms in the same PR.

### feat(provider): show status, reschedule and cancel

Stories: ZRN-10, ZRN-11.

## M5: Launch

Meet the bar for 1.0.

### test(ui): review accessibility against wcag 2.2 aa

Stories: SHL-8.

### ci: enforce the performance budgets

The first-load and memory budgets from the PRD.

### docs: settle the trademark, licence and final legal copy

Trademark search on "Lineup"; the licence if the repository becomes public; final privacy policy,
terms and README.

### docs: record the success measures

The four measures in the PRD, checked and written down. Mark the release as 1.0.0 with a
`Release-As: 1.0.0` footer; versions are never edited by hand.

### chore: archive the instaplanner repositories

Archive `davidmoralesz/instaplanner` and `davidmoralesz/instaplanner-vp`, with a pointer to this
one.
