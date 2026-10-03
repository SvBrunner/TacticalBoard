# TacticalBoard

A tactics board for drawing and saving game situations across different sports — both standard set-piece situations and freely, intuitively drawn new ones. Every situation is stored as JSON.

Currently implemented (the Phase 1 MVP, frontend only, floorball): create a situation on a full or half field; place, move, and color players (with position labels), balls, and markers; draw pass, run, and shot arrows that can be bent; undo/redo; multiple frames with descriptions, played back as a slideshow; export/import as JSON and export as an animated GIF. Works by touch on phones and tablets, in a light and a dark theme.

Planned: a backend with users and teams (per-team roles Admin, Editor, Reader) where a team organizes its saved situations into folders, and later more sports. See [docs/roadmap.md](docs/roadmap.md).

## Structure

```
TacticalBoard/
├── frontend/       SvelteKit app (the active codebase)
├── flake.nix       Nix dev shell (pnpm + nodejs)
└── .envrc          direnv hook for the flake
```

There is only a frontend today. `frontend/` (not `svelte/`) is named that way because a backend is planned.

## Getting started

With Nix + direnv:

```bash
direnv allow
cd frontend
pnpm install
pnpm run dev
```

Without Nix, install `pnpm` and Node.js yourself, then run the same commands from `frontend/`.

## Scripts (run from `frontend/`)

| Command | Purpose |
|---|---|
| `pnpm run dev` | Start the dev server |
| `pnpm run build` | Production build |
| `pnpm run preview` | Preview the production build |
| `pnpm run check` | Type-check with svelte-check |
| `pnpm test` | Run the Vitest test suite |

## Tech stack

- SvelteKit 2 + Svelte 5
- Konva / svelte-konva for the drawing canvas
- Vitest + Testing Library for tests

pnpm is the only supported package manager — the lockfile and `pnpm-workspace.yaml` in `frontend/` are the source of truth.

## Note

This project is built in collaboration with AI.
