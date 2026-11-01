# Lineup

[![Lint](https://github.com/studiobimo/lineup/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/studiobimo/lineup/actions/workflows/lint.yml)
[![Release](https://github.com/studiobimo/lineup/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/studiobimo/lineup/actions/workflows/release.yml)

Plan your Instagram feed before it goes live: arrange, sort by colour, group into albums and schedule posts.

> **Status: in development.** The app shell is scaffolded; the planner itself is not built yet.
> See the [roadmap](docs/ROADMAP.md).

## What it will do

- **Arrange.** Drop images in, drag them into the three-column grid Instagram uses, and preview
  the profile on a phone frame. Mouse, touch and keyboard all work.
- **Sort by colour.** One action orders a set of images into a rainbow, light to dark, or colour
  families, and one undo takes it back.
- **Albums.** Group images into a carousel post that moves as one cell.
- **Never lose work.** Every change can be undone, and the board stays in your browser.
- **Schedule.** With your own [Zernio](https://zernio.com) API key, see what is already published
  and schedule what comes next.

There are no accounts, and images stay on your device until you schedule them.

## How it is built

A client-rendered React app and a small Hono API, served by one Cloudflare Worker at
`lineup.bimo.dev`. The repository is a pnpm workspace: the app, the API, and a contract package
they share. The app follows studiobimo's `vite-react-tanstack` and `cloudflare` template profiles,
with coss ui for components and IndexedDB for the board.

| Read | For |
| --- | --- |
| [Product requirements](docs/PRD.md) | What it does, for whom, story by story |
| [Roadmap](docs/ROADMAP.md) | Milestones and their exit criteria; the work itself is in issues |
| [Decision records](docs/adr/) | Why it is built this way |
| [API conventions](docs/API.md) | The rules every endpoint follows |
| [Risks](docs/RISKS.md) | What could go wrong |

## Development

Requirements: [mise](https://mise.jdx.dev/getting-started.html).

```sh
make -C .devtools setup      # pinned tools + git hooks
make -C .devtools check      # everything CI runs
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## License

Copyright (c) 2026 studiobimo. All rights reserved. See [LICENSE](LICENSE).
