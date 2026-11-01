# ADR-0006: Roles and permissions with CASL

- **Status:** Superseded by [ADR-0008](0008-sealed-provider-key.md): there are no accounts in v1
- **Date:** 2026-10-10

## Context

From M4 Lineup has accounts. Most rules are ownership rules: a user may read and change only their
own account, sessions and provider key. An admin role is needed for support and abuse handling.

Lineup uses no authentication framework. Sign-in is a small hand-written magic-link flow, chosen
because it has no password hashing and so fits a Worker's CPU limit. A role is a column on the
user. Nothing in that design decides what a role may do, and the interface needs the same answer
as the API so it can hide what a user cannot do.

Options considered:

- **An auth framework's role plugin** (for example better-auth). It would bring the whole
  framework into the Worker for one feature. Rejected on size.
- **A small typed `can()` function** with no dependency. Enough for two roles today, but it
  would grow by hand as client projects need conditions and field rules.
- **CASL.** A small library for exactly this, usable in the Worker and the browser.

## Decision

Use **CASL** (`@casl/ability`), behind one function.

- `packages/contract` exports `defineAbilityFor(user)`. Nothing else imports CASL's builders.
- **The API is the only authority.** A Hono middleware builds the ability for the session user,
  and each route checks it before acting. Queries are still scoped by user id; the ability is a
  second, declarative check, not a replacement.
- The web app calls the same function (through `@casl/react`) only to decide what to show.
- **Roles:** `user` and `admin`.
- **Subjects in v1:** `Account`, `Session`, `ProviderCredential`.
- Ownership is a condition on `userId`. A banned or deleted user resolves to an empty ability.

## Consequences

- One definition of who may do what, shared by both sides and testable on its own.
- It is thin for Lineup today. Its value is as the studio's pattern for client work with richer roles.
- **Size:** CASL documents its core at about 6 kB gzipped. That is to be measured in the M4
  build against the Worker budget in [ADR-0005](0005-workspace-and-api-contract.md).
- **CPU:** building an ability and checking it are in-memory comparisons, with no I/O.
- If CASL fails the budget or proves more than is needed, the fallback is the typed `can()`
  function, and the change is confined to `defineAbilityFor`.
