# TacticalBoard

A tactics board for drawing and saving game situations across different sports — both standard set-piece situations and freely, intuitively drawn new ones. Every situation is stored as JSON.

Currently implemented: a floorball board where you place, move, and color player markers on a canvas, then save/load a board as JSON.

Planned: support for more sports, plus a user-management system with teams and per-team roles (Admin, Editor, Reader), where a team organizes its saved situations into folders.

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

## Tech stack

- SvelteKit 2 + Svelte 5
- Konva / svelte-konva for the drawing canvas
- Sveltestrap (Bootstrap) for UI chrome

pnpm is the only supported package manager — the lockfile and `pnpm-workspace.yaml` in `frontend/` are the source of truth.

## Note

This project is built in collaboration with AI.
