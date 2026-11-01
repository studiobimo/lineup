# ADR-0005: A workspace with a shared API contract

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

Lineup has a browser app and an API ([ADR-0001](0001-single-worker.md)). Both need the same
request and response shapes and the same validation. Keeping these in the app's own folders and
re-declaring response types by hand on the client, as an earlier studio project did, lets the two
sides drift.

Three conventions are also settled here because they shape the layout:

- every studio API is served under `/api/` with a version segment;
- TanStack Router is used with file-based routing, which its documentation recommends over
  code-based routing;
- on Cloudflare Workers the limits that matter most are the compressed bundle size and CPU time.

## Decision

Make the repository a **pnpm workspace** with one deployable and two packages.

```text
apps/web/             the React app, wrangler.jsonc, and the Worker entry that mounts the API
packages/api/         the Hono app: routes, middleware, key sealing, provider implementations
packages/contract/    what both sides share: Zod schemas, inferred types, error shapes
```

- **Contract.** Every request and response has a Zod schema in `packages/contract`. The API
  validates with them; the web app builds forms from them.
- **Typed client.** The web app calls the API through Hono's RPC client over the route type that
  `packages/api` exports. Requests and responses are typed end to end, with no code generation
  and no runtime cost beyond `fetch`.
- **Reference.** The OpenAPI document is generated from those routes and schemas, as described in
  [API.md](../API.md).
- **Base path and versions.** Routes are mounted at `/api/v1`. A breaking change adds `/api/v2`
  beside it, and `v1` stays until no released client calls it. `/api/health` is the one
  unversioned route. The rules for what goes under that path are in [API.md](../API.md).
- **Frontend routes.** File-based, in `apps/web/src/routes/`, with the router's Vite plugin
  listed before the React plugin. The generated `routeTree.gen.ts` is committed, never edited by
  hand, and excluded from lint and format.
- **Worker budget.**
  - The Worker bundle has a gzip size budget, checked in CI from the build output. The first
    number is set from the M0 scaffold with headroom, and raising it needs a reason in the PR.
  - `packages/api` takes no dependency that needs Node polyfills. A PR that adds a dependency
    there states its size.
  - CPU time is watched on staging through Workers observability, because CI cannot measure it
    reliably.
  - Costly work is kept out by design: there is no password hashing, and all image work is in
    the browser ([ADR-0002](0002-local-first-storage.md), [ADR-0004](0004-colour-autosort.md)).

## Consequences

- One place to change a shape, and the compiler finds every caller.
- There is still one Worker and one deploy; ADR-0001 is unchanged in substance.
- `vp run` runs tasks across the workspace, and the Makefile targets hide that.
- The web app's bundle and the Worker's bundle are separate: the React app is served as static
  assets and does not count toward the Worker's size.
- Type-level coupling means `packages/api` must type-check before `apps/web` does.
- The scaffold is more than 20 files, so it goes up as a stack.
