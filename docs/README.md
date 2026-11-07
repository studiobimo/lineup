# Lineup documentation

This folder is the source of truth for what Lineup is and why it is built the way it is.

- [Product requirements](PRD.md): the problem, the users, and every story with its acceptance
- [Roadmap](ROADMAP.md): milestones, their stories and exit criteria
- [Risks](RISKS.md): risks with mitigations, and assumptions
- [API conventions](API.md): paths, versions, errors, pagination and the other rules every endpoint follows
- Research:
  - [Instagram APIs](research/instagram-apis.md): the vendors compared, and what publishing through
    Meta directly would take
  - [Import sources](research/import-sources.md): local folders and Google Photos as ways in
  - [A native macOS app](research/native-macos.md): the argument for and against
- Architecture decision records:
  - [ADR-0001: One Cloudflare Worker for the app and the API](adr/0001-single-worker.md)
  - [ADR-0002: Local-first storage](adr/0002-local-first-storage.md)
  - [ADR-0003: Instagram through Zernio, with the user's own key](adr/0003-zernio-byok.md)
  - [ADR-0004: Colour autosort from a dominant colour in OKLCH](adr/0004-colour-autosort.md)
  - [ADR-0005: A workspace with a shared API contract](adr/0005-workspace-and-api-contract.md)
  - [ADR-0006: Roles and permissions with CASL](adr/0006-roles-and-permissions.md) (superseded)
  - [ADR-0007: The org's profiles, inside a workspace](adr/0007-web-and-cloudflare-profiles.md)
  - [ADR-0008: No accounts, and a sealed provider key](adr/0008-sealed-provider-key.md)
  - [ADR-0009: Web first, and a desktop app only with evidence](adr/0009-web-first-desktop-later.md)
  - [ADR-0010: One tab at a time changes a board](adr/0010-one-active-tab.md)
  - [ADR-0011: Drag with dnd kit's core package](adr/0011-drag-with-dnd-kit.md)
  - [ADR-0012: Animate arranging with Motion](adr/0012-animation-with-motion.md)
  - [ADR-0021: Decode HEIC in the import worker with libheif](adr/0021-heic-decoding.md)
  - [ADR-0020: Release with semantic-release](adr/0020-semantic-release.md)

A record is for a decision that is specific to this product, costly to reverse, and had real
alternatives. A stack choice the org's template profiles already make does not need one.

A new decision gets the next number and the same headings: Status, Date, Context, Decision,
Consequences. An accepted record is not rewritten; a later one supersedes it.
