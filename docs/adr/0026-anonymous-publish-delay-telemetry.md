# ADR-0026: Anonymous publish-delay telemetry

- **Status:** Accepted
- **Date:** 2026-11-22
- **Relates to:** [ADR-0008](0008-sealed-provider-key.md), [ADR-0024](0024-published-cells-leave-the-board.md)

## Context

A customer's grid came out in a different order from the one scheduled. Lineup sends a post to
Zernio with a time, and Zernio and Instagram publish it some time later. How much later, by kind
of post and by size, is not known: a carousel with a video may take minutes longer than an image,
and a slow post can be overtaken by one scheduled after it. Neither Zernio nor Instagram reports
this to us, and nothing on the device or the server records it. Until now the app has sent
nothing about how it is used: no analytics, no events (see the privacy page).

## Decision

**When the app sees a post it scheduled as published, it sends one small event to
`POST /api/v1/telemetry/publish-delay`. The Worker validates it, writes it as one structured log
line and stores nothing.**

- **What is sent, and nothing else:** a random event id made in the browser, `scheduledFor` and
  `publishedAt`, `delaySeconds` (their difference), the kind of media (`image`, `carousel` or
  `reel`), the number of images and of videos, the total bytes sent, the largest video's bytes and
  duration if there is one, and the app version. One Zod schema in `packages/contract` describes
  it, and the Worker refuses any other key.
- **An account tag, and never the username.** The browser also sends the connected account's
  handle, trimmed and lowercased, as `account`, so a customer who reports a late post can be found
  in the logs. The Worker never logs it. It computes HMAC-SHA-256 of the handle, keyed with the
  secret `TELEMETRY_SALT`, keeps the first 12 hex characters and logs that as `account`. The handle
  is only a function argument: it is not stored, and it is in no log line, error or response. With
  no `TELEMETRY_SALT` set, the line has no `account`, and nothing fails. The tag is stable for an
  account, so events from one account can be grouped, but it cannot be turned back into a handle
  without the salt, and a handle cannot be checked against it without the salt either.
  `.devtools/scripts/telemetry-tag.mjs` makes the same tag
  (`TELEMETRY_SALT=... pnpm telemetry:tag <handle>`), to look a customer up. Changing the salt
  makes earlier tags unmatchable.
- **Why the rest is anonymous.** The event id is a new random value that is not kept anywhere
  else, so it links to no account, board, provider post, caption, tag or url. There are no
  usernames, captions, tags, account or post ids, urls, keys, file names or image bytes. The
  Worker logs the validated fields and not the request, so the address and headers are not in the
  line; Cloudflare still sees the address as it does for any request, and keeps it for its own
  purposes.
- **Where the sizes come from.** Image sizes are not kept once a post is uploaded. When a post is
  scheduled, the upload step already holds every copy, so it records the shape of the post
  (`media`) next to the other optional fields of the post's entry in `board.posts`. The fields
  are optional, so no storage migration is needed and a board saved earlier opens as it did; a
  post scheduled before this release has no shape and sends nothing.
- **Where the times come from.** `scheduledFor` is the time the person chose. `publishedAt` is the
  time Zernio records for the platform's publication, which the API now passes through on a
  scheduled post. If it is missing, nothing is sent, because the moment the app noticed would
  measure the polling interval and not the delay.
- **At most once per post.** The sync marks the entry as reported before it sends, and the entry is
  then dropped from the board ([ADR-0024](0024-published-cells-leave-the-board.md)), so a reload
  never sends it again. A failed send is not retried: losing an event is cheaper than sending one
  twice.
- **The log line uses OpenTelemetry-style attribute names,** dotted and lowercase, so it can be
  exported as it is: `event.name` (`lineup.publish_delay`), `lineup.post.id` (the random id),
  `lineup.post.scheduled_for`, `lineup.post.published_at`, `lineup.post.delay_seconds`,
  `lineup.post.media_kind`, `lineup.post.image_count`, `lineup.post.video_count`,
  `lineup.post.total_bytes`, `lineup.post.largest_video_bytes`, `lineup.post.largest_video_seconds`,
  `lineup.account.tag` and `service.version`. The request body keeps its camelCase contract names.
- **The client is fire and forget.** It never waits, never shows an error and never delays a
  cell's removal. The planner, autosort and albums features do not call it; only the provider
  feature does, which already talks to the network.
- **The endpoint needs no key and no cookie,** since the event holds nothing of the person's. It is
  origin-checked like every state-changing request, answers 204, and is rate-limited by address
  with its own binding, restated in every environment.
- **The salt is set per environment,** once, and never committed: `openssl rand -base64 32`, then
  `pnpm exec wrangler secret put TELEMETRY_SALT --env development` and the same with
  `--env production`, from `apps/web`. Its name is in `.dev.vars.example` for local runs.
- **Workers observability is on in the deployed environments.** `observability` is restated in
  `env.development` and `env.production` with a head sampling rate of 1, so every line is kept.
  Workers Logs keeps them for seven days and they are read in the Cloudflare dashboard. No
  longer-lived store is added: if a longer view is needed, a later decision can add one.

## Consequences

- The privacy page now says that one anonymous event is sent when a scheduled post is published,
  and lists what it holds. ZRN-13 in the PRD covers it.
- There is a new route in `docs/API.md` and the OpenAPI document, outside the provider routes.
- The line is only as good as `publishedAt`: if Zernio omits it for a post, that post is not
  measured.
- A person who blocks the request loses nothing. There is no setting to turn it off in this
  release, since nothing in it identifies a person; one can be added if that changes.
- The Worker grows by one small route and no dependency.
- Exporting the logs to an OpenTelemetry backend is configuration only, with no SDK or dependency:
  create an OTLP logs destination in the Cloudflare dashboard (Observability, Destinations), add
  `observability.logs.destinations: ["<name>"]` to each environment in `wrangler.jsonc`, and
  optionally set `persist: false` to keep the logs out of Cloudflare. Persisted logs count toward
  Observability usage pricing from 1 December 2026. No destination is configured now.
