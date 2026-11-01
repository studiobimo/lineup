# ADR-0003: Instagram through Zernio, with the user's own key

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Users want to see what is already on their profile and to schedule posts from the plan. There
are three ways to reach Instagram, compared in the [API research](../research/instagram-apis.md):

1. **A unified posting API under one studio key.** We pay per connected account or per post.
2. **A unified posting API with each user's own key.** The user creates the vendor account.
3. **Meta's Instagram API directly.** Free and the smoothest for users, but serving other
   people's accounts requires Meta App Review, and we would run the scheduler, hold Instagram
   tokens and host each image at a public URL until it is published.

Zernio gives each account two connected social accounts free. Posting and reading both need the
same Instagram permission, so there is no cheaper "read-only" route.

## Decision

Use **Zernio with bring-your-own-key** for v1, behind a provider interface.

- The user pastes a Zernio API key in Settings. How it is narrowed, sealed and kept is in
  [ADR-0008](0008-sealed-provider-key.md).
- The browser never calls Zernio. The Worker exposes `/api/v1/provider/*` and implements a small
  interface: list accounts, list posts, request a media upload, schedule, update, cancel.
  Zernio is the first implementation.
- At schedule time the Worker asks Zernio for an upload URL and the browser sends the image
  straight to it. Media does not pass through or rest on studiobimo infrastructure.
- Zernio is the source of truth for posts. The link between a cell and its post is kept in the
  browser with the board. Each schedule request carries an idempotency id.
- Status is refreshed when the user looks. Per-user webhooks are deferred.

## Consequences

- No vendor cost to the studio, and none to a user with one Instagram account.
- No Meta review is needed to ship.
- Users must create a Zernio account and paste a key. That is real friction (RISKS.md, risk 3).
- We handle a secret that can post to someone's Instagram, and must treat it accordingly (risk 4).
- Whether Zernio returns posts made outside it is unconfirmed (risk 1). The M0 spike settles it.
- Swapping vendors, or adding a native Meta provider after 1.0, means a second implementation of
  the interface and no change to the planner.
