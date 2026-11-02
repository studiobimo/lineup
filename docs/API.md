# API conventions

How Lineup's HTTP API is shaped. The decision to have one, where it lives and how it is versioned
is in [ADR-0005](adr/0005-workspace-and-api-contract.md); this file is the day-to-day rulebook.

It is written to be reusable. Once a second studio web app exists, it should move to the org template.

## Base path and versions

- Everything is under `/api/`, with a version segment: `/api/v1/...`.
- `/api/health` is the only unversioned route.
- A version is a promise. Within `v1`, changes are additive only: new routes, new optional
  request fields, new response fields. Clients must ignore fields they do not know.
- A breaking change (removing or renaming a field, changing a type or a meaning, tightening
  validation) goes in `/api/v2`, mounted beside `v1`. `v1` stays until no released client calls it.
- An unknown path under `/api/` returns a JSON 404, never the web app's HTML.

## Resources and naming

- Paths name resources with plural nouns in kebab-case: `/api/v1/provider/scheduled-posts`.
- Identifiers are opaque strings (UUIDs). Clients never parse them.
- JSON fields are camelCase. Query parameters are camelCase.
- No trailing slashes. No verbs in paths, except for an action that is not a resource change;
  that is a `POST` to a sub-path named for the action: `POST /api/v1/provider/scheduled-posts/{id}/cancel`.

## Methods

| Method   | Use                                                            | Safe to retry                |
| -------- | -------------------------------------------------------------- | ---------------------------- |
| `GET`    | Read. Never changes anything                                   | Yes                          |
| `POST`   | Create, or perform an action                                   | Only with an idempotency key |
| `PATCH`  | Change some fields of one resource                             | Yes                          |
| `PUT`    | Replace one resource whole                                     | Yes                          |
| `DELETE` | Remove. Deleting something already gone is a 204, not an error | Yes                          |

## Status codes

| Code | Meaning here                                                                          |
| ---- | ------------------------------------------------------------------------------------- |
| 200  | Success with a body                                                                   |
| 201  | Created; the body is the new resource                                                 |
| 204  | Success with no body                                                                  |
| 400  | The request is malformed or fails validation                                          |
| 401  | No valid provider key: missing, expired or altered                                    |
| 403  | Refused: a failed origin check, or the provider key does not allow this               |
| 404  | No such resource                                                                      |
| 409  | Conflict with current state, including a reused idempotency key with a different body |
| 422  | Well-formed, but refused by a business rule                                           |
| 429  | Rate limited                                                                          |
| 500  | Our fault. The body carries a request id and nothing internal                         |
| 502  | The upstream provider failed                                                          |

## Requests and responses

- Bodies are JSON, `Content-Type: application/json`.
- Every request and response has a Zod schema in `packages/contract`. A route without one is not merged.
- A single resource is returned as the object itself. A list is returned in an envelope (see Pagination).
- Timestamps are ISO 8601 in UTC with a `Z`: `2026-10-10T14:30:00Z`. A time the user chose in a
  zone is sent with its IANA zone name in a separate field.
- Absent optional values are omitted, not sent as `null`, unless `null` has its own meaning.
- Secrets are write-only. A provider key can be set and cleared; it is never returned.

## Errors

One shape for every error, following [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details:

```json
{
  "type": "https://lineup.bimo.dev/problems/validation",
  "title": "The request is not valid",
  "status": 400,
  "code": "validation",
  "requestId": "01JA…",
  "errors": [{ "path": "scheduledFor", "message": "Must be in the future" }]
}
```

- `Content-Type: application/problem+json`.
- `code` is a stable, documented string that clients may branch on. `title` is for people and may change.
- `errors` appears only for validation failures.
- `requestId` is on every error and matches the `X-Request-Id` response header and the server log.
- A 500 never includes a stack trace, a query or an upstream message.

## Pagination

- Lists use a cursor, not page numbers: `?limit=50&cursor=…`.
- The response is `{ "items": [...], "nextCursor": "…" }`. `nextCursor` is absent on the last page.
- `limit` has a default and a maximum, both stated in the schema.
- The order is fixed and stated for each list.

## Idempotency

- A `POST` that creates something at the provider (scheduling a post) requires an
  `Idempotency-Key` header: a UUID the client generates once per attempt and reuses on retry.
- Repeating a key returns the original result for 24 hours, whatever the body: the provider holds
  the record, and Lineup keeps none. A repeat while the first request is still running is a 409
  with `Retry-After`. Never reuse a key for a different post.

## The provider key

There are no accounts, sessions or bearer tokens ([ADR-0008](adr/0008-sealed-provider-key.md)).

- `PUT /api/v1/provider/key` takes the pasted key, narrows it where Zernio allows, and sets the sealed
  cookie. It returns `{ "last4": "…", "expiresAt": "…" }`. `last4` is from the key that was pasted,
  the one a person can recognise. A key that sees several profiles gets a 409 with `code:
"profile_required"` and the `profiles`; the client sends the key again with a `profileId`.
- `GET /api/v1/provider/key` returns the same fields, or 404 if there is no valid key.
- `DELETE /api/v1/provider/key` clears the cookie.
- The cookie uses the `__Host-` prefix and is HttpOnly, Secure and `SameSite=Strict`, with a
  `Max-Age` of at most 30 days.
- The Worker unseals the key per request, in memory, and keeps nothing.
- Provider routes are a fixed list. There is no generic proxy, and no route takes a URL to forward to.
- Every state-changing request is origin-checked.

## Provider routes

All under `/api/v1/provider`, and the whole list. Each needs the sealed cookie except `PUT key`.

| Route                              | Purpose                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `GET /accounts`                    | The Instagram accounts this key can reach                         |
| `GET /connect-url`                 | Where to connect an account, for a key with none                  |
| `GET /accounts/{id}/posts`         | What is already live, newest first                                |
| `POST /uploads`                    | An upload URL. The browser sends the image straight to it         |
| `GET /scheduled-posts?accountId=…` | Posts made through Lineup, with their status                      |
| `POST /scheduled-posts`            | Schedule. Needs `Idempotency-Key`, and refuses a time in the past |
| `PATCH /scheduled-posts/{id}`      | Change the time or the caption until it is published              |
| `DELETE /scheduled-posts/{id}`     | Cancel. Refused once it is published                              |

## Rate limiting

- A limited request gets a 429 with a `Retry-After` header in seconds.
- Setting a provider key is limited, so the route cannot be used to test stolen keys in bulk.

## Headers

| Header            | Direction | Purpose                                                              |
| ----------------- | --------- | -------------------------------------------------------------------- |
| `X-Request-Id`    | Response  | Correlates a response with the server log                            |
| `Idempotency-Key` | Request   | See Idempotency                                                      |
| `Cache-Control`   | Response  | `no-store` on everything under `/api/` unless a route says otherwise |
| `Retry-After`     | Response  | See Rate limiting                                                    |

## Logging

Logs record the method, the path template, the status, the duration and the request id. They
never record bodies, query strings, cookies, authorisation headers or keys.

## Reference

The API reference is generated, so it cannot disagree with the code. Nobody writes it by hand.

- Every route uses `validator`, `describeRoute` and `resolver` from
  [`hono-openapi`](https://hono.dev/examples/hono-openapi), with plain Zod schemas from
  `packages/contract`. [`@hono/zod-openapi`](https://hono.dev/examples/zod-openapi) was the
  alternative, but its schemas must import `z` from that package, which would pull it into the
  contract and so into the browser.
- A build step calls `generateSpecs` and writes an OpenAPI 3.1 document to
  `packages/api/openapi.json`, which is committed. The generator stays out of the Worker bundle, and
  every API change shows up as a diff in its pull request.
- `make -C .devtools check` fails if the document is stale, or if a route has no description.
- CI compares the document with `main`, and a breaking change under `v1` fails. That is how "a
  version is a promise" is enforced.
- The document is published as a static file at `/api-docs/openapi.json`.
- An interactive reference, [Scalar](https://github.com/scalar/scalar), runs at `/api-docs/` in
  local development and on staging. It is left out of production, because a third-party script must
  not run on the origin that holds the provider key.
