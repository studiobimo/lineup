# ADR-0020: Release with semantic-release

- **Status:** Proposed
- **Date:** 2026-11-02

## Context

The template releases with release-please, which keeps a standing release pull request and tags
when a person merges it. [ADR-0019](0019-develop-and-main.md) promotes `develop` to `main` with a
merge commit so that release-please can read each Conventional Commit. That makes a release two
steps after the promotion (the promotion, then the release pull request), and the release pull
request, opened with `GITHUB_TOKEN`, runs none of the required checks until it is merged with the
bypass checkbox or a GitHub App is installed.

## Decision

- `main` releases with semantic-release, through the reusable `semantic-release.yml` in
  `studiobimo/.github`. A push to `main` computes the next version and, if there is one, creates the
  tag and the GitHub Release. Nothing is committed back.
- release-please's config and manifest are removed. The two tools write the same tags, so only one
  runs.
- The promotion pull request stays a merge commit (ADR-0019): semantic-release reads every commit
  reachable from `main`, and a squash would still leave it one line.

## Consequences

- Merging the promotion is the release. There is no second pull request to merge and no check that
  cannot run.
- semantic-release has no pre-1.0 mode. With no tag the first release is `1.0.0`; to start at
  `0.x`, push a starting tag such as `v0.0.0` before the first promotion, after which a `feat`
  is a minor bump and only a breaking change reaches `1.0.0`. This is undecided.
- There is no `CHANGELOG.md`. The release notes are on the GitHub Release, so the release-notes
  page (SHL-10, issue 46) cannot be built from a file in the repository. It will read the Releases
  at build time, which needs a token while the repository is private, or the workflow will need the
  changelog and git plugins, which commit back to `main`. This is undecided.
- The template's managed text in `AGENTS.md` and `CONTRIBUTING.md` still names release-please.
  Those blocks change in `studiobimo/project-template`, not here, so they stay wrong until the
  template does.
- The workflow does not exist at `@v1` until `studiobimo/.github` releases it, so this change cannot
  merge before then.
