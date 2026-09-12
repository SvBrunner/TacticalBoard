# CLAUDE.md

Guidance for Claude Code when working in this repo. For what the project is and how to set it up, see README.md — this file doesn't repeat that.

## Code style

- Clean Code and SOLID principles apply throughout.
- Work class-based: prefer classes with clear responsibilities over loose collections of functions operating on shared state, both in app logic and (once it exists) the backend.
- Frontend markup must be semantic HTML — use the element that matches its meaning (`<nav>`, `<button>`, `<ul>`/`<li>` used correctly, etc.), not generic `<div>`/`<span>` soup with visual styling standing in for structure.

## Testing

Every component needs thorough test coverage — this is a hard requirement, not a nice-to-have. When adding or changing a component, add or update its tests in the same change.

## Domain assumptions

Don't make functional/business-logic assumptions about how the app should behave (rules for situations, team roles, permissions, workflows, etc.). If it isn't specified, ask rather than guessing.

## Git workflow

- Never commit unless the user explicitly asks for that commit, in that moment. Finishing a change is not implicit permission to commit it.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`, ...).

## Layout notes not in README

There used to be a React Native/Expo prototype and an extra `Svelte/TacticalBoard/` nesting level; both were removed as dead weight — don't recreate that structure.

**pnpm only.** `frontend/pnpm-lock.yaml` and `frontend/pnpm-workspace.yaml` are the source of truth. Never add back a `package-lock.json` — one was already removed for being a redundant, unused npm lockfile.

Run `pnpm run build` and `pnpm run check` (both from `frontend/`) after any nontrivial change — this app previously went a long time without either being run, letting real breakage hide (see git history around the Svelte 5 / Vite 8 dependency upgrade).

Known technical limitations of the current implementation are tracked in `docs/`, not here.
