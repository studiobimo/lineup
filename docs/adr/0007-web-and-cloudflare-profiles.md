# ADR-0007: Build the app on the org's profiles, inside a workspace

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The first plan for this repository named its stack directly: Vite+ for tooling and coss ui for
components. Since then `studiobimo/project-template` has gained two profiles that settle these
questions for every web app:

- `vite-react-tanstack`: Vite, React 19, TanStack Router, Query and Form, zod, i18next, Tailwind v4,
  shadcn/ui, Vitest, ESLint and Prettier, with a generator and a bundle budget.
- `cloudflare`: one Worker, static assets, Hono under `/api/*`, environments, a deploy workflow.

They differ from what this repository planned:

| Subject | Planned here | Profiles |
| --- | --- | --- |
| Toolchain | Vite+ with oxlint and oxfmt | Vite, ESLint, Prettier |
| CI | New reusable `ci-web.yml` | `ci.yml`, managed by the template |
| Components | coss ui | shadcn/ui through the shadcn CLI, which also installs coss |
| Layout | `apps/web`, `packages/api`, `packages/contract` | One package: `src/` and `worker/` at the root |

The workspace is worth keeping. A package boundary stops the web app importing server code, and the
compiler enforces it, which a folder cannot do. It also leaves room for a second app later.

## Decision

Use the profiles for everything except where the app sits. A stack choice the profiles make is not
recorded here, because the template is where it is decided.

- `.template-profiles` lists `vite-react-tanstack` and then `cloudflare`.
- Vite+ and the planned reusable workflows are dropped.
- The profile's `deploy.yml` is the one exception: deploys stay with `cf:deploy` or the Cloudflare
  dashboard ([ADR-0001](0001-single-worker.md)), so the file is listed in `.template-ignore`.
- The profiles apply **inside `apps/web`**, whose own layout is theirs: `src/` for the app and
  `worker/` for the Worker entry. `packages/api` and `packages/contract` stay as ADR-0005 has them.
- **The template gains one setting for the app's directory, defaulting to the root**
  (`studiobimo/project-template#35`). Flat projects do not change, and no profile logic is forked
  here. Most of the shared configs already work relative to the app; the make targets and the
  generator are what need it.
- Schemas stay in `packages/contract`, where the profiles' guidance says
  `src/features/<name>/schema.ts`. That guidance needs the same setting's caveat.
- coss ui stays, as the one choice of Lineup's own. It installs with `shadcn init @coss/style` into
  the path the profile expects. Its gaps are small: no Sidebar and no Carousel, so the tray is a
  plain `aside` with a Drawer on mobile, and onboarding is a stepped dialog.

## Consequences

- Most of M0's tooling work disappears, and the app stays in step with other studio projects.
- M0 now depends on a change to `studiobimo/project-template`, which has to be released first.
- The profiles have not been used in a workspace yet, so Lineup finds any problems first (risk 5).
- With no accounts ([ADR-0008](0008-sealed-provider-key.md)), `packages/api` starts small. The
  boundary is still useful, but it earns less until the API grows.
- Oxlint and oxfmt's speed is given up.
