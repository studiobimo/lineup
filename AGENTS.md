# Agent guide: Lineup

Instructions for AI coding agents (Codex, Claude Code, and others) working in this repo.
`CLAUDE.md` only points here, so this file is the single source for every agent.

## Project

Plan your Instagram feed before it goes live: arrange, sort by colour, group into albums and schedule posts.

Lineup is a client-rendered React app with a small API, served together from one Cloudflare
Worker at `lineup.bimo.dev`. The planner is local-first: images and board order live in the
device and never reach the server. There are no accounts: a user's own Zernio API key, sealed in
an HttpOnly cookie, lets the Worker read and schedule Instagram posts. **The repository holds
documentation only so far**; the app is scaffolded in milestone M0. "Grid" with a capital in the PRD means the
planned feed, never the product.

- What it is and how to use it: `README.md`
- What to build, and why: `docs/PRD.md` (stories have IDs such as `ARR-3`; cite them in PRs)
- What each milestone delivers, and when it is done: `docs/ROADMAP.md`
- What to do next: GitHub issues, grouped by milestone. Until they are seeded, `docs/BACKLOG.md`
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

Planned in M0, not present yet. The repository is a pnpm workspace (ADR-0005). `apps/web` follows
the `vite-react-tanstack` and `cloudflare` template profiles (ADR-0007), which add their own
sections to this file when they are synced:

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

## Non-negotiables

These hold in every studiobimo repo. Git hooks, CI and an agent hook all enforce them, so a
violation is caught before it is reviewed.

- **Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/),
  `<type>(<scope>): <summary>`. PRs are squash-merged, so the **PR title** must be one too.
  commitlint checks both against its conventional config: a lowercase summary with no full stop,
  at most 100 characters in the header and in each body line, and a scope from the project's list.
- **Branches:** [Conventional Branch](https://conventionalbranch.org/), `<type>/<description>`
  in lowercase with single hyphens, e.g. `feat/short-description`. Agents may use `claude/…` or
  `codex/…`.
- **PR size:** at most 20 changed files. Split bigger work with `gh stack`
  (`gh stack init`, `gh stack add`, `gh stack submit`).
- **Versioning:** SemVer, managed by release-please. Never edit a version, a
  `.release-please-manifest.json` or a `CHANGELOG.md` by hand.
- **Pinning:** third-party GitHub Actions are pinned to full commit SHAs with the version in a
  comment; studiobimo's own reusable workflows are called at `@v1`. Every tool is pinned in
  `mise.toml` and locked in `mise.lock`. Dependabot does not read `mise.toml`: a tool is bumped by
  hand, then `make -C .devtools lock`, and `mise.toml`, `mise.lock` and `.mise/locks/` are
  committed together.
- **Workflows:** `permissions: {}` at the top, the minimum per job, `persist-credentials: false`
  on every checkout, secrets passed explicitly and never with `secrets: inherit`.
- **Say what you tested.** State what you ran and what it showed. If something could not be
  tested, say so plainly rather than implying it was.

A PreToolUse hook (`.devtools/scripts/agent-guard.sh`) blocks `gh pr create`, `gh stack submit`
and `git push` when the PR-size rule is violated, and blocks non-conventional branch names.

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
difference is deliberate, list the path in `.template-ignore` with a comment saying why.
<!-- <<< template:rules -->

## Commands

```sh
make -C .devtools setup   # once: pinned tools + git hooks
make -C .devtools check   # everything CI runs
make -C .devtools lint    # the pre-commit hook, on every file
make -C .devtools lock    # after changing a pinned version
make -C .devtools drift   # where this repo differs from the template
make -C .devtools sync    # pull the template's managed files
make -C .devtools github  # apply the org's GitHub settings and rulesets (CHECK=1 to compare)
make -C .devtools help    # all targets
```

## Conventions

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
  The OpenAPI document is generated from the routes; never edit it by hand.
- **Routes are file-based.** Add a file under `apps/web/src/routes/`; never write code-based
  routes, and never edit `routeTree.gen.ts`.
- **The Worker is on a budget.** `packages/api` takes no dependency that needs Node polyfills, a
  PR adding one there states its gzip size, and nothing CPU-heavy runs on the server (ADR-0005).
- **Images stay out of memory.** Cells show thumbnails, off-screen cells hold no decoded image,
  and image bytes never enter application state. All persistence goes through `BoardStore`
  (ADR-0002).
- **Network numbers live in one profile.** Columns, cell ratio and carousel limit are never
  repeated outside the network profile, and provider code outside the Zernio implementation uses
  neutral names, so a second network stays cheap.
- **Every board change is undoable.** A new store action goes through the history, and its test
  asserts undo and redo.
- **Storage changes ship with a migration** and a test that opens a board saved by the previous release.
- **Spelling is British** in prose and identifiers (`colour`), matching the rest of the org.
- **Work starts from an issue.** Its title is the Conventional Commit the PR will use, and its
  milestone is the one the story belongs to. See Planning in `CONTRIBUTING.md`.
