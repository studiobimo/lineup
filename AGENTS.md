# Agent guide: Lineup

Instructions for AI coding agents (Codex, Claude Code, and others) working in this repo.
`CLAUDE.md` only points here, so this file is the single source for every agent.

## Project

Plan your Instagram feed before it goes live: arrange, sort by colour, group into albums and schedule posts.

Lineup is a client-rendered React app with a small API, served together from one Cloudflare
Worker at `lineup.bimo.dev`. The planner is local-first: images and board order live in the
device and never reach the server. There are no accounts: a user's own Zernio API key, sealed in
an HttpOnly cookie, lets the Worker read and schedule Instagram posts. "Grid" with a capital in the
PRD means the planned feed, never the product.

- What it is and how to use it: `README.md`
- What to build, and why: `docs/PRD.md` (stories have IDs such as `ARR-3`; cite them in PRs)
- What each milestone delivers, and when it is done: `docs/ROADMAP.md`
- What to do next: GitHub issues, grouped by milestone
- Decisions already made: `docs/adr/`. Read the relevant one before changing its subject
- How every endpoint is shaped: `docs/API.md`
- Workflow and conventions in full: `CONTRIBUTING.md`
- Commit scopes: `build`, `ci`, `docs`, `deps`, `devtools`, `planner`, `autosort`, `albums`,
  `provider`, `api`, `contract`, `ui`. `.commitlintrc.yaml` enforces this list, so add a
  scope in both places.

## Layout

```text
.devtools/               Makefile (project targets), base.mk (shared targets), lefthook-base.yml (shared hooks)
  scripts/               agent-guard.sh, template-sync.sh, github-setup.sh, and this project's own scripts
.github/workflows/       thin wrappers over studiobimo/.github reusable workflows
.claude/  .codex/        agent settings and the PreToolUse hook that runs agent-guard.sh
mise.toml  mise.lock     every tool the hooks and CI run, pinned; .mise/locks/ belongs with them
lefthook.yml             this project's hooks, on top of the shared ones
.commitlintrc.yaml       commit rules: commitlint's conventional config plus this project's scopes
AGENTS.md  CLAUDE.md     this guide; CLAUDE.md only imports it
docs/                    PRD.md, ROADMAP.md, RISKS.md, adr/ (decision records), research/
```

The repository is a pnpm workspace (ADR-0005). `apps/web` follows the `vite-react-tanstack` and
`cloudflare` template profiles (ADR-0007), whose sections are at the end of this file. The feature
folders and the image worker arrive with their milestones, and `packages/api` and
`packages/contract` are empty until M4:

```text
apps/web/                the deployable: React app, wrangler.jsonc, the Worker entry
  src/routes/            file-based routes (TanStack Router); routeTree.gen.ts is generated
  src/components/ui/     coss ui components, copied in by the shadcn CLI; not linted or formatted
  src/features/          planner, autosort, albums, provider, legal: one folder each
  src/workers/           the image import worker (a browser Web Worker, not the Cloudflare one)
  worker/                the Worker entry, which mounts packages/api
packages/api/            the Hono app, mounted at /api/v1: routes, key sealing, providers
packages/contract/       shared by both: Zod schemas, inferred types, error shapes
```

<!-- >>> template:rules -->
## Non-negotiables

These hold in every studiobimo repo. Git hooks, CI and an agent hook all enforce them, so a
violation is caught before it is reviewed.

- **Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/),
  `<type>(<scope>): <summary>`. PRs are squash-merged, so the **PR title** must be one too.
  commitlint checks both against its conventional config: a lowercase summary with no full stop,
  at most 100 characters in the header and in each body line, and a scope from the project's list.
- **Issues:** titled the same way, like the commit that will close them: `fix: …`, `feat: …`,
  `docs: …`. The issue forms start the title with a type, and the `issue-title` workflow labels
  and comments on any issue whose title fails commitlint until it is fixed.
- **Branches:** [Conventional Branch](https://conventionalbranch.org/), `<type>/<description>`
  in lowercase with single hyphens, e.g. `feat/short-description`. Agents may use `claude/…` or
  `codex/…`.
- **PR size:** at most 20 changed files. Split bigger work with `gh stack`
  (`gh stack init`, `gh stack add`, `gh stack submit`).
- **Versioning:** SemVer, set by the project's release tooling. Never edit a version, create a
  tag, or write a `CHANGELOG.md` or release manifest by hand.
- **Pinning:** third-party GitHub Actions are pinned to full commit SHAs with the version in a
  comment; studiobimo's own reusable workflows are called at `@v1`. Every tool is pinned in
  `mise.toml` and locked in `mise.lock`. Dependabot does not read `mise.toml`: a tool is bumped by
  hand, then `make -C .devtools lock`, and `mise.toml`, `mise.lock` and `.mise/locks/` are
  committed together.
- **Workflows:** `permissions: {}` at the top, the minimum per job, `persist-credentials: false`
  on every checkout, secrets passed explicitly and never with `secrets: inherit`.
- **No comments** in code files. Code that seems to need one gets a well-named helper or clearer
  names instead. A suppression (`eslint-disable`, `@ts-ignore`, `# noqa`) is a finding too: fix
  what the linter flags. `.uncomment.toml` sets what `uncomment` checks, in the pre-commit hook.
- **One source of truth.** Domain logic, validation rules, schemas and configuration values live
  in exactly one place, in application code, tests, build scripts and workflows alike. Replace
  duplication with shared functions or modules: fewer lines through consolidation, never through
  clever one-liners. `make -C .devtools check` runs jscpd (`.jscpd.json`), and knip where there
  is a `package.json`.
- **Repo health:** the `repo-health` workflow runs these and more (lizard: functions under 80
  lines) over every tracked file. A finding fails it unless `.repo-health/baseline.json` lists it
  with an open issue, and each pull request resolves at least one listed finding while any are
  left. Changing an analyser's config needs the `repo-health-config-change` label.
- **Constants by domain:** grouped in objects, `DOMAIN.group.name`, not `DOMAIN_GROUP_NAME`.
- **Say what you tested.** State what you ran and what it showed. If something could not be
  tested, say so plainly rather than implying it was.

A PreToolUse hook (`.devtools/scripts/agent-guard.sh`) blocks `gh pr create`, `gh stack submit`
and `git push` when the PR-size rule is violated, and blocks non-conventional branch names from
`git switch -c`, `git checkout -b`, `git worktree add -b`, `git branch` and `gh stack`.

## Where shared things live

Some files here are not this repo's to edit. Changing them locally only creates drift, which a
weekly workflow reports as an issue.

| To change | Edit it in | It reaches this repo by |
| --- | --- | --- |
| CI behaviour (lint, PR checks, release) | `studiobimo/.github`, `.github/workflows/` | the `@v1` tag moving |
| Branch and PR-size rules | `studiobimo/.github`, `.devtools/` | the `@v1` tag moving; lefthook refetches it daily |
| Shared hooks and tool versions | `studiobimo/project-template` | `make -C .devtools sync` |
| Files and blocks listed in the template's `.template/manifest`, and in the manifest of each profile in `.template-profiles` | `studiobimo/project-template` | `make -C .devtools sync` |

A managed block sits between `>>> template:<name>` and `<<< template:<name>` marker lines, like
this section. Edit outside the markers freely; inside them, change the template instead. If a
difference is deliberate, list the path in `.template-ignore` with a comment saying why. Entries
the manifest marks `required` cannot be ignored, and CODEOWNERS sends any change to the override
files to the fleet's owners.
<!-- <<< template:rules -->

## Commands

```sh
make -C .devtools setup   # once: pinned tools + git hooks
make -C .devtools check   # everything CI runs
make -C .devtools e2e     # Playwright, against the built app
make -C .devtools worker-budget  # fail if the Worker outgrows its gzip budget
make -C .devtools memory-budget  # fail if a 300-image board passes the PRD's memory limit (Linux)
make -C .devtools openapi # regenerate the API reference from the routes
make -C .devtools lint    # the pre-commit hook, on every file
make -C .devtools lock    # after changing a pinned version
make -C .devtools drift   # where this repo differs from the template
make -C .devtools sync    # pull the template's managed files
make -C .devtools github  # apply the org's GitHub settings and rulesets (CHECK=1 to compare)
make -C .devtools help    # all targets
```

Deploys run from a machine signed in with `wrangler login`, or through Workers Builds, so no
Cloudflare credential is kept in GitHub (ADR-0019). Each builds and deploys in one step, and
refuses to run from any branch but its own:

```sh
pnpm cf:bundle             # the Worker's size, with no login; it does not fail on a size
pnpm cf:deploy:development  # from develop, to lineup-dev.bimo.dev
pnpm cf:deploy:production   # from main, to lineup.bimo.dev
pnpm cf:rotate-secret:development  # add the next sealing secret, keeping the old one
pnpm cf:rotate-secret:production   # the same; on a new Worker, this sets V1
```

## Conventions

- **Branches and environments.** Pull requests go to `develop`, which ships to the `development`
  environment; `main` ships to `production` (ADR-0019). This overrides the staging environment
  and `deploy.yml` that the managed Hosting section below describes.
- **Docs first.** A change in behaviour updates the PRD story it touches; a change of approach
  gets a new ADR that supersedes the old one. ADRs are not edited after they are accepted,
  except for their status.
- **Local-first is a hard rule.** Nothing in the `planner`, `autosort` or `albums` features may
  call the network. Images go to a third party only from the schedule flow.
- **Secrets.** A user's provider key is never returned in a response, logged, stored on a server,
  or readable by script in the browser (ADR-0008). No secret is ever kept in plain form.
- **One schema per concept.** Zod schemas live in `packages/contract` and are used by the API to
  validate and by the web app to build forms and to type the client. Do not re-declare a
  response type by hand.
- **Every endpoint is under `/api/v1`** and follows `docs/API.md`. Only `/api/health` is unversioned.
  The OpenAPI document is generated from the routes; never edit it by hand. A route describes
  itself with `documented`, and `make -C .devtools openapi` writes the change.
- **Routes are file-based.** Add a file under `apps/web/src/routes/`; never write code-based
  routes, and never edit `routeTree.gen.ts`.
- **The Worker is on a budget.** `packages/api` takes no dependency that needs Node polyfills, a
  PR adding one there states its gzip size, and nothing CPU-heavy runs on the server (ADR-0005).
- **The content security policy is in `apps/web/public/_headers`.** It covers the app and static
  assets, not Worker responses. A feature adds what it needs and no more, and assets are never
  inlined, because the policy allows no `data:` URIs. The Playwright smoke test fails on a violation.
- **Images stay out of memory.** Cells show thumbnails, off-screen cells hold no decoded image,
  and image bytes never enter application state. A cell draws an `ImageBitmap` to a canvas, at
  the size the cell is shown, and frees it, because Chromium keeps what an `<img>` loaded from a
  `blob:` URL even after both are gone. `make -C .devtools memory-budget` holds a 300-image board
  to the PRD's limit. All persistence goes through `BoardStore` (ADR-0002).
- **Network numbers live in one profile.** Columns, cell ratio and carousel limit are never
  repeated outside the network profile, and provider code outside the Zernio implementation uses
  neutral names, so a second network stays cheap.
- **Every board change is undoable.** A new store action goes through the history, and its test
  asserts undo and redo.
- **Storage changes ship with a migration** and a test that opens a board saved by the previous release.
- **Icon-only buttons use `IconButton`,** which requires a label and shows it as a tooltip.
- **Every app-wide provider goes in `AppProviders`,** in `src/components/app-providers.tsx`.
- **The first load has a limit,** 200 kB of script before any lazy route, which `make -C .devtools
  first-load` enforces. TanStack Query and Form are kept out of it: they load with the provider's
  screens, whose `ProviderQueries` holds the one query client. So a route loader has no query
  client, and code from `gen.mjs` that expects one needs that moved into a feature.
- **Page edges use `gutter`** (`px-gutter`, `p-gutter`), the spacing token in `src/index.css`, so
  every region lines up. Padding inside a component keeps its own size.
- **Spelling is British** in prose and identifiers (`colour`), matching the rest of the org.
- **Work starts from an issue.** Its title is the Conventional Commit the PR will use, and its
  milestone is the one the story belongs to. See Planning in `CONTRIBUTING.md`.

<!-- >>> template:vite -->
## Web app: Vite, React and TanStack

The `vite-react-tanstack` profile keeps this section, the shared configs in `.devtools/vite/`
and the scripts beside them in step with the template. The project's own `vite.config.ts`,
`vitest.config.ts`, `eslint.config.js` and `tsconfig*.json` import or extend those configs and
add only what is particular to it.

### Stack

- React 19 in StrictMode, TypeScript in `strict` mode, built with Vite.
- **Routing:** TanStack Router, file-based. A route is a file under `src/routes/`; the router
  plugin writes `src/routeTree.gen.ts` from them and splits each route into its own chunk.
- **Server state:** TanStack Query. **Forms:** TanStack Form. **Validation:** zod.
- **Strings:** i18next with react-i18next, from catalogs in `src/locales/`.
- **Styling:** Tailwind CSS v4, configured in `src/index.css`. Components: shadcn/ui in
  `src/components/ui/`, added with `pnpm exec shadcn add <name>`: the CLI is a devDependency,
  so the lockfile pins it like every other package (`pnpm add -D shadcn` in an older project).
- **Tests:** Vitest with Testing Library, next to the code as `*.test.ts(x)`.
- **Packages:** pnpm, pinned in `mise.toml`. Never add `package-lock.json` or `yarn.lock`.
- **Hosting** is another profile's job. Nothing in `src/` should know where the app runs:
  it reaches its backend over HTTP, at `/api`. A hosting profile writes `.devtools/host/`,
  and the shared Vite, Vitest, ESLint and make configs take its part from there.

### Layout

```text
src/
  routes/            file routes, kept thin: they load data and render a feature's page
  features/<name>/   flat: schema.ts, queries.ts, <name>-page.tsx and their tests
  locales/<lang>/    one JSON catalog per namespace: common.json, then one per feature
  i18n/config.ts     loads every catalog; locales.test.ts holds each language to the same keys
  components/ui/     shadcn/ui primitives; regenerate them, do not hand-edit them. ESLint and
                     Prettier leave them out
  components/        shared components; hooks/ and lib/ hold shared hooks and helpers
  config/site.ts     the site's name, description and URL, for index.html and the app
  routeTree.gen.ts   generated by the router plugin; committed, never edited
```

`@/` is `src/`. A feature folder stays flat, so one `ls` shows all of it. Only code that more
than one feature uses moves up to `components/`, `hooks/` or `lib/`.

In a workspace the app sits in `APP_DIR`, which `.devtools/Makefile` sets, and the layout above
is inside it. Its `package.json` lists what the app imports. The root's lists the tools that
`.devtools/` imports, since those resolve from the root. `.prettierignore` stays at the root.
Run `pnpm exec shadcn` from `APP_DIR`.

With more than one app, list them in `APPS` instead (`APPS := apps/admin apps/site`). `build`,
`typecheck`, `budget`, `clean` and the host's `types` and `deploy` then run once per app and stop
at the first that fails; `dev` and `preview` take the first. `APP=apps/site` narrows any of them
to one app. Give an app its own budget with `BUNDLE_DIR@apps/site`, `BUNDLE_CHUNK_KIB@apps/site`
or `BUNDLE_TOTAL_KIB@apps/site`. `gen.mjs` writes the first app.

Every other package extends the same presets as the app, so it gets every shared check without
opting in to each. ESLint uses the nearest config to each file, and `make -C .devtools` finds a
package by its `src/`, not from a list:

- **ESLint:** `react` is the app's `app` without what only a Vite app has (Fast Refresh, the
  router). A hardcoded string in a `.tsx` file fails in any package.
- **Vitest:** `base` is the React setup: jsdom, `globals`, the React plugin, `src/test/setup.ts`
  when there is one. `make test` runs a package with no `vitest.config.ts` on it as it is.
- **tsc:** `make typecheck` runs `tsc -b` in a package that has a `src/`, and fails when it has
  no `tsconfig.json`. No list to edit.
- **Apps:** a package with a `vite.config.ts` that is not in `APPS` (or `APP_DIR`) fails
  `make budget`, so an app cannot go without a build and a budget.

A new package needs a `package.json`, and these two files for the default case:

```js
// packages/<name>/eslint.config.js
import { defineConfig } from 'eslint/config'

import { react } from '../../.devtools/vite/eslint.js'

export default defineConfig([react])
```

```json
// packages/<name>/tsconfig.json
{ "extends": "../../.devtools/vite/tsconfig.package.json" }
```

What is particular to a package is an override in its own config, where it can be seen. A package
that is not React, or is exempt, turns off what does not apply:

```js
// packages/<name>/eslint.config.js: a library with no UI
export default defineConfig([react, { rules: { 'i18next/no-literal-string': 'off' } }])
```

```json
// packages/<name>/tsconfig.json: runs in Node, not a browser
{
  "extends": "../../.devtools/vite/tsconfig.package.json",
  "compilerOptions": { "lib": ["ES2023"], "types": ["node", "vitest/globals"] }
}
```

```ts
// packages/<name>/vitest.config.ts: only when the default is not enough
import { defineConfig, mergeConfig } from 'vitest/config'

import { base } from '../../.devtools/vite/vitest.ts'

export default mergeConfig(base, defineConfig({ test: { environment: 'node' } }))
```

### Conventions

- **Scaffold with the generator** rather than copying the nearest file: it writes code that
  is formatted, lint-clean and tested from the start. `pnpm gen` runs it too.

  ```sh
  node .devtools/scripts/gen.mjs feature invoices            # schema, query, page, test
  node .devtools/scripts/gen.mjs route /invoices --feature invoices
  node .devtools/scripts/gen.mjs route '/invoices/$invoiceId'
  node .devtools/scripts/gen.mjs component status-badge      # or: hook <name>
  ```

- **No inline strings.** Text a person reads, including `aria-label`, `title`, `alt` and
  `placeholder`, comes from a catalog through `t()`, even in an app with one language: it
  keeps copy in one place to review and makes a second language a new folder, not a
  rewrite. ESLint's `i18next/no-literal-string` enforces it. A feature's strings go in its
  own namespace, `useTranslation('<feature>')`; shared ones in `common`. A key with no
  string fails any test that renders it.
- **One schema per concept.** A feature's zod schema validates its form, its API responses
  and, on the server, its requests. Never write a second schema for the same payload. A
  workspace may keep shared schemas in a package instead of `src/features/<name>/schema.ts`.
- **Query options live with the feature.** `queries.ts` exports `queryOptions(...)`, so a
  route's `loader` can `ensureQueryData` what its page then reads with `useSuspenseQuery`.
- **Code-splitting.** Routes split themselves. Use `lazy()` with `<Suspense>` for heavy,
  rarely seen components (editors, charts, dialogs), never for small or above-the-fold
  ones. Vendor chunks are set in `.devtools/vite/vite.ts`. The bundle budget
  (`make -C .devtools budget`) is a signal to split, not a number to raise quietly.
- **Styling uses the design tokens.** No raw colour values outside `src/index.css`; use the
  semantic utilities (`bg-card`, `text-muted-foreground`).
- **Abstract before duplicating.** Extend an existing component or helper rather than adding
  a parallel one. knip fails on unused files, exports and dependencies; `knip.json` exempts the
  shadcn/ui primitives and the dependencies a new app has before its first feature.

### Commands

```sh
make -C .devtools install   # the packages pnpm-lock.yaml pins
make -C .devtools dev       # Vite dev server on http://localhost:5173
make -C .devtools ci        # build, types, ESLint, knip, jscpd, Prettier, tests, budget, audit
make -C .devtools fmt       # Prettier over the web sources
```
<!-- <<< template:vite -->

<!-- >>> template:cloudflare -->
## Hosting: Cloudflare Workers

The `cloudflare` profile keeps this section and `.devtools/host/` in step with the template.
The shared Vite, Vitest, ESLint and make configs load their Cloudflare parts from there, so
the project's own config files never name the host. `wrangler.jsonc`, `.dev.vars.example`
and `worker/` are the project's. In a workspace they sit in each app's directory (`APP_DIR`, or
every entry of `APPS`), so run `wrangler` there.

- **One Worker serves the app.** Static files come from `dist/client`, and any path that is
  not a file falls back to `index.html` for the router. Only `/api/*` runs the Hono app in
  `worker/index.ts`. `make -C .devtools dev` runs it in workerd beside the client, with
  the bindings in `wrangler.jsonc` simulated locally.
- **Environments.** The top level of `wrangler.jsonc` is local development. Deploys go to
  `env.development` or `env.production`, as `<name>-development` and `<name>-production`.
  Neither inherits bindings or vars from the top level, so restate them in each. A project
  with no development environment or `develop` branch sets `DEPLOY_ENVS := production` in
  `.devtools/Makefile`, and keeps only `env.production`.
- **Deploy with `make -C .devtools deploy ENV=<env>`.** The environment is fixed when the
  app is built, not when it is deployed. The target builds and deploys in one step;
  `wrangler deploy` after a plain build ships local development's bindings. It refuses to
  run from any branch but the one its environment ships from: `develop` for development,
  `main` for production.
- **`deploy.yml` runs the same target:** on a push to `develop` to development, and to
  production when `release.yml` calls it for a release. A run from Actions defaults to the
  first environment in `DEPLOY_ENVS`. It needs a repository variable,
  `CLOUDFLARE_ACCOUNT_ID`, and in each of its GitHub environments a `CLOUDFLARE_API_TOKEN`
  secret, from the "Edit Cloudflare Workers" template and limited to the account.
- **Or Workers Builds runs it**, with no Cloudflare credential in GitHub: connect the repo
  to each Worker, set its branch to the environment's, and its deploy command to
  `make -C .devtools deploy ENV=<env>`. The image has no mise, so the target uses its node
  and pnpm, and refuses to deploy unless they are the ones `mise.toml` pins: set the build
  variables `NODE_VERSION` and `PNPM_VERSION` to match. Use one of the two, never both, or
  every push deploys twice.
- **Secrets** are never committed. List their names in `.dev.vars.example`. Put local
  values in `.dev.vars`, and deployed ones with
  `pnpm exec wrangler secret put <NAME> --env <env>`.
- **The `Env` type** is `worker/worker-configuration.d.ts`, generated from `wrangler.jsonc`
  by `make -C .devtools types` and ignored by git. `typecheck` runs it first.
- **Worker tests** sit beside the code as `worker/**/*.test.ts`. They call
  `app.request(path, init, env)` with `env` from `getPlatformProxy()`, and run in Node, not
  workerd. Code that imports a `cloudflare:*` module is tested through its binding.
- **One schema per concept** holds across the boundary: a route validates its input with
  the feature's schema from `src/features/<name>/schema.ts`, or from a workspace's shared
  package.
<!-- <<< template:cloudflare -->
