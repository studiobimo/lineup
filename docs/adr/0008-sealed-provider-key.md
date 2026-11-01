# ADR-0008: No accounts, and a sealed provider key

- **Status:** Accepted
- **Date:** 2026-10-31
- **Supersedes:** the key storage and accounts in [ADR-0003](0003-zernio-byok.md), and
  [ADR-0006](0006-roles-and-permissions.md). The M0 spike confirms the first step of the decision.

## Context

Accounts existed for one reason: to hold a user's Zernio key on our server. That one reason brought
D1, Drizzle, magic links, Resend, Turnstile, rate limits, sessions, CASL, account deletion, and a
database of secrets that can each post to someone's Instagram.

A server-side account gives v1 almost nothing in return. Zernio holds and publishes scheduled posts,
so nothing of ours has to run while the user is away. Boards do not sync, so a key that followed the
user would arrive at an empty board.

The key still has to be protected. It cannot be hashed, because a hash cannot be turned back into
the key that Zernio needs. Encryption only helps if the means to decrypt is out of reach of whatever
can read the ciphertext.

| Option | Script on the page reads the key | Theft from disk | Kept on a server | Verdict |
| --- | --- | --- | --- | --- |
| Plain in IndexedDB | Yes | Yes | No | Rejected |
| Encrypted in the browser, with a non-extractable WebCrypto key | Yes: it cannot export the key, but it can ask for a decrypt | Mostly stopped | No | Rejected |
| Encrypted under a passkey or passphrase | While unlocked | Stopped | No | More interface, for less than the chosen option |
| In a database, behind accounts | No | Stopped | Yes, everyone's | Rejected: this is what is being removed |
| **Sealed in an HttpOnly cookie** | **No** | **Stopped: useless without our Worker secret** | **No** | **Chosen** |
| Pasted every session, memory only | Yes, while in memory | Stopped | No | The fallback |

## Decision

There are no accounts in v1. The key is narrowed, sealed, and kept where no script can read it.

1. **Narrow it.** At setup the Worker exchanges the pasted key for a restricted one, through Zernio's
   `POST /v1/api-keys`: `scope: "profiles"` for the one chosen profile, `disabledResourceGroups` for
   everything Lineup does not use, and `expiresIn: 30`. A restricted key cannot manage keys, so it
   cannot widen itself. The pasted key is discarded. If it is already restricted, or the spike shows
   the exchange does not work, the key is sealed as given and the guide explains how to create a
   narrow one in Zernio's dashboard.
2. **Seal it.** AES-256-GCM through WebCrypto, under a versioned Worker secret. The sealed value
   carries its expiry, so changing it breaks the seal.
3. **Keep it from scripts.** The sealed value is a `__Host-` cookie: HttpOnly, Secure,
   `SameSite=Strict`, with no `Domain`, so other `bimo.dev` subdomains never see it.
4. **Store nothing.** The Worker unseals per request, in memory, calls Zernio, and forgets. There is
   no database and no KV. Cookies, headers and bodies are never logged.
5. **Expire it.** Thirty days at most, enforced by the seal and by Zernio. The user then pastes a key
   again. Nothing planned or already scheduled is affected.
6. **Limit what it can reach.** The API exposes a fixed list of provider routes, never a generic
   proxy. Every state-changing request is origin-checked.
7. **Defend the page.** A strict Content-Security-Policy and no third-party scripts in production.
8. **Show the state.** Settings shows the last four characters and the expiry date. "Forget key"
   clears the cookie. No API for revoking a key is documented, so the interface links to Zernio's
   dashboard for a lost device.

Accounts return with cloud sync, the first feature that needs them.

## Consequences

- The accounts milestone and epic leave v1, along with D1, Resend, Turnstile and risks 10 and 11,
  and the Worker stays almost static.
- There is no store of keys to breach. An attacker needs our Worker secret and a user's cookie.
- A cross-site scripting bug cannot read the key, as with a server-side key. It could use the API
  while the page is open, limited to what the restricted key allows, until it expires.
- The key passes through the Worker in memory on each request. The privacy policy says so.
- A stolen, unlocked device can post until the key expires, unless it is revoked at Zernio.
- Pasting a key every 30 days is friction (risk 3), and a user with two browsers does it twice.
- Rotating the Worker secret signs everyone out of their key unless old versions are kept for 30 days.
- A native Meta provider needs a server to hold tokens and run jobs, so it would bring accounts
  back. That is a reason to delay it.
