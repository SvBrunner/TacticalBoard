# TacticalBoard

A tactics board for drawing and saving game situations across different sports — both standard set-piece situations and freely, intuitively drawn new ones. Every situation is stored as JSON.

Currently implemented (the Phase 1 MVP, frontend only, floorball): create a situation on a full or half field; place, move, and color players (with position labels), balls, and markers; draw pass, run, and shot arrows that can be bent; undo/redo; multiple frames with descriptions, played back as a slideshow; export/import as JSON and export as an animated GIF. Works by touch on phones and tablets, in a light and a dark theme.

In progress (Phase 2): a backend with users and teams (per-team roles Admin, Editor, Reader) where a team organizes its saved situations into folders; later more sports. The backend skeleton exists (modules, database, migrations, health endpoint, Docker Compose stack); its features follow step by step. See [docs/roadmap.md](docs/roadmap.md).

## Structure

```
TacticalBoard/
├── frontend/       SvelteKit app, built as a static SPA (adapter-static)
├── backend/        .NET 10 modular monolith (ASP.NET Core, EF Core + PostgreSQL)
├── deploy/         Configuration for the local Compose stack (reverse proxy, dev IdP realm)
├── compose.yaml    Local development stack: proxy, frontend, backend, PostgreSQL, Keycloak
├── docs/           Roadmap, architecture (arc42), known limitations
├── flake.nix       Nix dev shell (pnpm, nodejs, .NET SDK)
└── .envrc          direnv hook for the flake
```

The backend's structure (one project per module, dependency rules) is described in [arc42 ch. 5](docs/arc42/05_building_block_view.md).

## Getting started

With Nix + direnv:

```bash
direnv allow
cd frontend
pnpm install
pnpm run dev
```

Without Nix, install `pnpm` and Node.js yourself, then run the same commands from `frontend/`.

The frontend works on its own (local mode: export/import only); it doesn't need the backend.

## Backend

The Nix dev shell provides the .NET 10 SDK. Docker (or another container runtime) is needed for the integration tests and the Compose stack; install it on your system — a dev shell can't provide a container daemon.

```bash
cd backend
dotnet build
dotnet test                                     # unit + integration tests (integration tests need Docker)
dotnet test --project tests/TacticalBoard.UnitTests   # unit and architecture tests only, no Docker
```

Integration tests start a PostgreSQL container with Testcontainers.

To run the backend outside Compose, start only the database (`docker compose up -d db`), then:

```bash
cd backend
dotnet run --project src/TacticalBoard.Api      # http://localhost:5080, e.g. /api/health
```

`appsettings.Development.json` points at the Compose database on `localhost:5432`.

**Configuration** is done through environment variables (`ConnectionStrings__TacticalBoard`, `Database__MigrateOnStartup`, `App__PublicBaseUrl`); the full list is in [arc42 ch. 7](docs/arc42/07_deployment_view.md). Migrations are applied when the backend starts (unless `Database__MigrateOnStartup=false`).

**Adding a migration** after changing the model (a unit test fails while the model and the migrations differ):

```bash
cd backend
dotnet tool restore
dotnet ef migrations add <Name> --project src/TacticalBoard.Api --output-dir Persistence/Migrations
```

## Running the whole stack (Docker Compose)

```bash
docker compose up --build        # from the repository root
```

| URL | What |
|---|---|
| http://localhost:8080 | The app (reverse proxy: `/api`, `/auth` → backend, everything else → frontend) |
| http://localhost:8080/api/health | Backend health (incl. database) |
| http://localhost:8180 | Keycloak (development identity provider) |
| `localhost:5432` | PostgreSQL (database, user and password: `tacticalboard`) |

Development credentials (local use only):

| What | Credentials |
|---|---|
| Keycloak admin console (http://localhost:8180/admin) | `admin` / `admin` |
| Test users in the realm `tacticalboard` | `trainer` / `trainer`, `player` / `player` |
| OIDC client for the backend | client ID `tacticalboard`, secret `tacticalboard-dev-secret`, issuer `http://localhost:8180/realms/tacticalboard` (containers reach Keycloak at `http://idp:8080`), redirect URI `http://localhost:8080/auth/callback` |

The backend doesn't use the identity provider yet; login follows in the next roadmap step. Keycloak runs in dev mode and keeps no data: the realm is re-imported from `deploy/keycloak/tacticalboard-realm.json` when its container is recreated.

Stop with `docker compose down`; `docker compose down -v` also deletes the database volume.

## Frontend scripts (run from `frontend/`)

| Command | Purpose |
|---|---|
| `pnpm run dev` | Start the dev server |
| `pnpm run build` | Production build |
| `pnpm run preview` | Preview the production build |
| `pnpm run check` | Type-check with svelte-check |
| `pnpm test` | Run the Vitest test suite |

## Tech stack

- Frontend: SvelteKit 2 + Svelte 5 (static build), Konva / svelte-konva for the drawing canvas, Vitest + Testing Library for tests
- Backend: .NET 10, ASP.NET Core (minimal APIs), EF Core with Npgsql (PostgreSQL), xUnit v3 + Testcontainers, NetArchTest for architecture rules
- Deployment: OCI containers, Docker Compose, Caddy as reverse proxy and static file server

pnpm is the only supported package manager — the lockfile and `pnpm-workspace.yaml` in `frontend/` are the source of truth.

## Note

This project is built in collaboration with AI.
