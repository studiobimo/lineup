# Roadmap

What each milestone is for, which [PRD](PRD.md) stories it delivers, and how we know it is done.
Each milestone here is a GitHub milestone with the same title. **The work itself and its status
live in issues**, not in this file; see [Planning](../CONTRIBUTING.md#planning-milestones-and-issues).

A milestone closes when every exit criterion below is met. Milestones are not tied to version
numbers: release-please decides those from the commits.

## M0: Foundation

An empty app deploys to staging. The planner comes first and needs no API, so the Worker has no
routes until M4 ([ADR-0001](adr/0001-single-worker.md)).

**Stories:** none.

### Exit criteria

- `make -C .devtools check` passes locally and in CI
- The shell is live on staging, under a strict Content-Security-Policy
- A Worker over its size budget fails CI
- release-please opens a release pull request

## M1: Planner core

The first public release: import, arrange, preview and undo, on `lineup.bimo.dev`. Everything after
this ships to real users, and they decide what the next priorities are.

**Stories:** IMP-1 to IMP-8; ARR-1 to ARR-10, ARR-12, ARR-14, ARR-15; REV-1, REV-2, REV-4; HIS-1 to HIS-4; SHL-1 to
SHL-7.

### Exit criteria

- Every "Must" story above passes its acceptance, on desktop and at 360 px with touch
- A 50-image import keeps the page interactive
- A 300-image board stays within the PRD's memory budget
- Unit tests cover every store action followed by undo and redo
- Playwright covers import, drag with mouse and touch emulation, and undo
- An axe scan of the main screen reports no violations
- Manual pass on one iOS and one Android phone
- It is live on production

## M2: Autosort and durability

The feature that sets the planner apart, and the protection a local-first app owes its users.

**Stories:** SRT-1 to SRT-6, SRT-8; ARR-13; HIS-5; SHL-9; IMP-9.

### Exit criteria

- Fixture tests fix the expected order for each strategy, including a set of greys
- Sorting 300 images takes under 100 ms on a mid-range phone
- Sort then undo leaves the board byte-identical
- A board backed up on one device and restored on another is identical
- The app installs, and works with the network off
- A folder board keeps originals at full size and survives a browser restart, and the option is
  absent in Safari and Firefox

## M3: Albums

Several images planned as one post.

**Stories:** ALB-1 to ALB-7; ARR-11; REV-3; SRT-7.

### Exit criteria

- Every action in E2, E4 and E5 has a test with an album in the set
- A board saved by the previous release opens unchanged
- A backup made by the previous release restores unchanged

## M4: Instagram through Zernio

See what is live and schedule what is next. It starts with the provider spike, because this
milestone and ADR-0008 depend on its answers. ADR-0003 and ADR-0008 call it the M0 spike; it moved
here so that the planner is finished first.

**Stories:** ZRN-1 to ZRN-14; REV-5.

### Exit criteria

- The spike's answers are in [research/instagram-apis.md](research/instagram-apis.md), and ZRN-6 is
  confirmed or reworded
- The API reference is generated from the routes, on staging and not in production
- Tests prove the key appears in no response, log or stored value, and that an expired or altered
  cookie is refused
- On staging, with a test Instagram professional account: an image and a carousel are scheduled,
  rescheduled, cancelled and published, and each state matches the Zernio dashboard
- A repeated schedule request creates one post

## M5: Launch

The move to 1.0. The app is already live, so this milestone is about meeting the bar.

**Stories:** SHL-8, SHL-10.

### Exit criteria

- Every "Must" story in the PRD passes on production
- The performance and memory budgets are met and enforced in CI
- The accessibility review against WCAG 2.2 AA is done
- The four success measures in the PRD are checked and recorded
- The privacy policy, terms and README are final
- `davidmoralesz/instaplanner` and `davidmoralesz/instaplanner-vp` are archived with a pointer

## Later

Not scheduled. Each needs its own ADR before it starts.

- A desktop shell, if the folder store shows people want one ([research](research/native-macos.md))
- More networks, starting with those Zernio already supports. Each needs a network profile
- Cloud sync of boards and images, which brings accounts back
- Native Meta publishing as a second provider, so users connect Instagram without a Zernio key.
  It needs a server and accounts. Open: when to register the Meta app
- Import from Google Photos through its Picker API; then Google Drive and Dropbox pickers on the
  same import-source interface. Open: can the browser fetch picked images directly, and does the
  scope need Google's app verification?
- Video and Reels, which are a large share of a real profile grid
- Multiple boards
- Grid-aware sort layouts: column gradients, row bands, checkerboard
- Export the plan as an image
