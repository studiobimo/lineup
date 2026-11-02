# ADR-0020: Release with semantic-release, through a promotion pull request

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

The template releases with release-please, which keeps a standing release pull request on `main`
and tags when a person merges it. [ADR-0019](0019-develop-and-main.md) promotes `develop` to
`main` with a merge commit, so that release-please can read each Conventional Commit. That makes
a release two pull requests after the work is done (the promotion, then the release pull request),
and the release pull request, opened with `GITHUB_TOKEN`, runs none of the required checks.

## Decision

- Pull requests merge into `develop`. A push to `develop` runs `promote-release.yml`
  (`studiobimo/.github`), which asks a semantic-release dry run for the next version. If there is
  one it opens `chore(release): v<version>` from a `release/v<version>` branch into `main`, with
  the release notes and the issues the work closes. The branch is throwaway because merging a
  `develop` pull request would delete `develop`.
- A person merges that pull request, with a merge commit (ADR-0019), when ready to release.
- A push to `main` runs `semantic-release.yml`, which tags `v<version>` and cuts the GitHub Release.
  Nothing is committed back.
- release-please's config and manifest are removed. The two tools write the same tags, so only one
  runs.
- The version starts from a `v0.0.0` tag on the first commit of `main`, so the first release is
  `0.1.0` and only a breaking change reaches `1.0.0`. semantic-release has no pre-1.0 mode of its
  own.
- The size rule does not count a `release/v*` pull request into the default branch, in
  `studiobimo/.github`'s `ci-pr`: each change in it passed the rule in its own pull request.

## Consequences

- Releasing is one merge, of a pull request that was already checked and described.
- The pull request needs the release app (`RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY`)
  or its required checks never run. A private repository on the Free plan gets neither from the
  organization, so both are added to this repository.
- An open release pull request stays at the commit it was made at. If later commits on `develop`
  change the version, a second one opens, and the older is closed by hand.
- There is no `CHANGELOG.md`. The release notes are on the GitHub Release, so the release-notes
  page (SHL-10, issue 46) cannot be built from a file in the repository. It will read the Releases
  at build time, which needs a token while the repository is private, or the workflow will need the
  changelog and git plugins, which commit back to `main`. This is undecided.
- `AGENTS.md` and `CONTRIBUTING.md` carry managed blocks from `studiobimo/project-template` that
  named release-please. They are edited here, so `make -C .devtools drift` reports them until the
  template changes the same lines.
- The workflows do not exist at `@v1` until `studiobimo/.github` releases them, so this change
  cannot merge before then.
