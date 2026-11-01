# Research: Instagram APIs

Date: 2026-10-09. Background for [ADR-0003](../adr/0003-zernio-byok.md). The M4 spike
results are appended to this file when they are known.

Items marked **unverified** were not confirmed against a primary source in this research.

## 1. Unified posting APIs

Zernio is the former Late (getlate.dev), renamed in 2026. One Trustpilot reviewer claims a roughly tenfold price
rise with the rebrand; the vendor says pricing is unchanged, and the published rate card still shows two free accounts.

| Option | Cost model | Fits bring-your-own-key | Reads posts made outside it | Main drawback |
| --- | --- | --- | --- | --- |
| Zernio | Per connected account: 2 free, then $6 (3 to 10), $3 (11 to 100), $1 (101+) | Yes; a free key covers one Instagram account | Unverified | Cost scales per account past two |
| Post for Me | Flat $10/month, 1,000 posts, unlimited accounts | Poorly; no free tier | Lists "read social account feeds"; Instagram unverified | Every user would pay |
| Ayrshare | Per profile, from $149/month | No | Unverified | Price |
| bundle.social | Free tier, then $100/month | Possibly | Not checked | Jump after free tier |
| Upload-Post, PostPeer | Free tier, then about $24 to $25/month | Possibly | Not checked | Only competitor write-ups found |
| Postiz | AGPL-3.0, self-hosted or paid cloud | Only for users running their own instance | Not checked | Needs Postgres, Redis, Temporal; cannot run on Workers |

Zernio facts used in the plan: base URL `https://zernio.com/api/v1`, bearer key, `GET /v1/connect/instagram`,
`POST /v1/posts` (`scheduledFor`, `timezone`, `x-request-id` idempotency), `POST /v1/media/presign`,
`GET /v1/usage-stats` to validate a key, 60 requests/minute on the free tier, carousels up to 10 items (check
against Meta's 20 in the spike).

Zernio keys, from its docs on 2026-10-31: `POST /v1/api-keys` takes `expiresIn` in days, `scope` of `full` or
`profiles` with `profileIds`, `permission` of `read-write` or `read`, and `disabledResourceGroups`. Any disabled
group makes it a restricted `zrk_` key, which cannot manage keys. Revoking is documented only in the dashboard.

Most comparison data came from vendor-written articles; treat prices as approximate.

## 2. Publishing directly through Meta (no third-party API)

Question raised: use an API only to fetch, and post and schedule from our own app?

**Finding: the split does not exist in that direction.** Posting to Instagram from our app can only mean calling
Meta's Instagram API ourselves. The login and permission that allow publishing also allow reading the account's
media (**unverified** for the exact media-listing endpoint; expected under `instagram_business_basic`). So once
we can post natively, a separate fetch API is redundant. A fetch-only third party would otherwise be either
another unified API (same key friction as Zernio) or a scraper, which breaks Meta's terms and is fragile.

What native publishing requires, from Meta's content publishing and App Review docs:

- **Access**: Instagram API with Instagram Login, permissions `instagram_business_basic` and
  `instagram_business_content_publish`. Serving other people's accounts makes us a Tech Provider, which needs
  Advanced Access and App Review. An app used only for a business we own needs no review.
- **Accounts**: professional accounts only.
- **Media**: images must be JPEG at a publicly reachable URL at publish time. There is no direct upload for
  images, so a scheduled image has to be stored on our side (R2) until it is published.
- **Flow**: create a container, poll its status, then call `media_publish`. Meta's page now gives 20 carousel
  items, up from the 10 first recorded here. Every image in a carousel is cropped to the first image's ratio.
- **Scheduling**: not provided. Containers expire after 24 hours, so we must hold the job and publish on time
  ourselves (cron trigger or Durable Object alarm over a D1 table).
- **Limits**: 100 API-published posts per account per 24 hours (the same page also says 50 in the carousel section).

Trade-off against Zernio with bring-your-own-key:

| | Zernio BYOK | Native Meta |
| --- | --- | --- |
| User setup | Create a Zernio account, paste a key | Click "Connect Instagram" |
| Cost | Free to us; free to the user for 2 accounts | Free |
| Reads native posts | Unverified | Yes (expected) |
| Our backend | Thin proxy, encrypted key | Token storage and refresh, job scheduler, R2 media, retries |
| Where images go | Browser to Zernio | Browser to our R2, deleted after publish |
| Gate | None | Meta App Review, likely business verification (**unverified**) |
| Who owns reliability | Zernio | Us; a missed post is our failure |

## 3. Recommendation

1. Ship v1 on Zernio BYOK, behind a small provider interface in the Worker (accounts, list posts, upload media,
   schedule, cancel) so the vendor can be swapped without touching the UI.
2. Treat native Meta publishing as the long-term provider, added after 1.0. Register the Meta app early: in
   the "own business" case no review is needed, so it can be built and used on our own account while review runs.
3. Do not adopt a fetch-only API.
4. Widen the M4 spike: test whether Zernio and Post for Me return posts not created through them. If
   neither does, the "see published posts in the grid" story waits for the native provider. Also check that a
   full key can mint a restricted one ([ADR-0008](../adr/0008-sealed-provider-key.md)).
5. If key-pasting proves too much friction before the native provider is ready, Post for Me under one
   studio-held key is the cheapest stopgap ($10/month flat up to 1,000 posts).

## Sources

- <https://zernio.com/pricing.md>
- <https://docs.zernio.com/>
- <https://docs.zernio.com/multi-tenant>
- <https://docs.zernio.com/api-keys/create-api-key>
- <https://zernio.com/llms.txt>
- <https://www.postforme.dev/pricing>
- <https://postproxy.dev/blog/best-social-media-scheduling-apis-compared/>
- <https://www.blotato.com/blog/zernio-vs-ayrshare>
- <https://zernio.com/blog/ayrshare-alternative>
- <https://opentweet.io/vs/zernio>
- `trustpilot.com/review/zernio.com` (blocks automated link checks)
- <https://developers.facebook.com/documentation/instagram-platform/overview>
- <https://developers.facebook.com/documentation/instagram-platform/app-review>
- <https://developers.facebook.com/documentation/instagram-platform/content-publishing>
- <https://cdn.jsdelivr.net/gh/gitroomhq/postiz-app@main/README.md>
