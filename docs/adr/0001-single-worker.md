# ADR-0001: One Cloudflare Worker for the app and the API

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

Until M4 the app is static files. From M4 it needs an API that unseals a user's provider key and
calls Zernio. The prototype ran on Cloudflare Pages with a Next.js adapter. Another studio project
runs a React app and a Hono API from a single Worker in production, and that layout has held up.

All studio apps live under `bimo.dev`.

## Decision

Serve Lineup from **one Worker**: static assets for the app, Hono for `/api/*`, on the same origin.
Routes are versioned under `/api/v1` ([ADR-0005](0005-workspace-and-api-contract.md)).

- `wrangler.jsonc` uses static assets with single-page-application fallback and
  `run_worker_first: ["/api/*"]`.
- The home is the subdomain `lineup.bimo.dev`, with staging on its own subdomain. A path under
  `bimo.dev` is ruled out: it would share one origin with other studio apps, and with it
  IndexedDB, localStorage and cookies.
- There is no database. Request bodies are validated with Zod schemas shared with the client
  through `packages/contract`.
- The top level of `wrangler.jsonc` is staging and `env.production` restates every binding,
  because named environments inherit nothing.
- Deploys run with `cf:deploy:staging` and `cf:deploy:production`, as in other studio projects, or
  through Workers Builds by linking the repository in the Cloudflare dashboard. Either way no
  Cloudflare credential is kept in GitHub. The environment is fixed when the app is built, so the
  scripts build and deploy in one step.

## Consequences

- Same origin means there is no CORS to configure, and a host-bound HttpOnly cookie with an origin
  check covers CSRF.
- Script running on the page can reach the API, so the Content-Security-Policy is what guards it
  ([ADR-0008](0008-sealed-provider-key.md)).
- The Worker exists from M0 with no routes, so adding the API later changes no infrastructure.
- The template's `deploy.yml` is not used, so it is listed in `.template-ignore`.
- The app has no server rendering. Legal pages are static files; nothing needs search indexing
  beyond the landing copy in `index.html`.
