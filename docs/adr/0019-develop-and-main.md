# ADR-0019: `develop` and `main`, one environment each

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

[ADR-0001](0001-single-worker.md) has a staging environment and no branch for it, so anything merged
to `main` was one step from production, and any laptop could deploy any branch. The owner wants two
GitHub environments, `production` from `main` and `development` from `develop`, with deploys through
the Wrangler CLI on the `davidmorales` Cloudflare account.

Cloudflare's own feature for this, Worker Previews, runs under the production Worker. It is in open
beta, and Workers Builds offers it for every branch that is not the production branch or for none.
A stack here is about a hundred branches, so each push would build all of them.

## Decision

- `develop` is the integration branch. Pull requests go to it and are squash-merged.
- `develop` ships to `env.development`, the Worker `lineup-development` at `lineup-dev.bimo.dev`.
  `main` ships to `env.production`, the Worker `lineup-production` at `lineup.bimo.dev`. This
  replaces staging, and `lineup-dev` stays one label under `bimo.dev`, which the zone's universal
  certificate covers.
- A second, separate Worker does the job of a preview rather than a Worker Preview: it is one stable
  address with its own secret and rate limit, and the API reference stays on it and off production.
- `make -C .devtools deploy` refuses to run from any branch but the environment's own.
- `develop` reaches `main` by a pull request merged with a merge commit. A squash would leave
  release-please one commit to read, and a rebase would rewrite `develop` on every release.
- Workers Builds stays an option, as in ADR-0001: each Worker connected to its own branch as that
  Worker's production branch, with preview builds off. No Cloudflare credential goes in GitHub.

## Consequences

- `main` has merge commits, which the linear history rule in the org's rulesets refuses. Rulesets
  cannot run on this private repository on GitHub's Free plan, so the conflict waits until they can,
  and an exception for promotion pull requests is needed then.
- GitHub acts on `Closes` only at the default branch, and squashed commits here have no body, so a
  merge into `develop` closes nothing. The pull request that promotes `develop` lists every issue
  it ships.
- GitHub's Free plan gives a private repository no environment secrets, and its branch rules on
  environments are documented for paid plans only. The two environments hold no secrets, and show
  nothing until something records a deployment against them.
- `PROVIDER_KEY_SECRET_V1` is set once per Worker, with `wrangler secret put --env <env>`.
- A pull request has no deployed copy of its own, so `develop` shows work after it merges.
