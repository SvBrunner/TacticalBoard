# TacticalBoard

A tactics board for drawing and saving game situations across different sports — both standard set-piece situations and freely, intuitively drawn new ones. Every situation is stored as JSON.

Currently implemented (the Phase 1 MVP, frontend only, floorball): create a situation on a full or half field; place, move, and color players (with position labels), balls, and markers; draw pass, run, and shot arrows that can be bent; undo/redo; multiple frames with descriptions, played back as a slideshow; export/import as JSON and export as an animated GIF. Works by touch on phones and tablets, in a light and a dark theme.

In progress (Phase 2): a backend with users and teams (per-team roles Admin, Editor, Reader) where a team organizes its saved situations into folders; later more sports. Done so far: the backend skeleton (modules, database, migrations, health endpoint, Docker Compose stack) and the login through any OpenID Connect provider (users created on first login, editable display name, log in/out on the start page). Without login the app works exactly as before (local mode). See [docs/roadmap.md](docs/roadmap.md).

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

The frontend works on its own (local mode: export/import only); it doesn't need the backend. Without a backend the start page shows "Local mode" where "Log in" would be.

**Frontend and backend together, with login** (dev server, hot reload):

```bash
# from the repository root, each in its own terminal
docker compose up -d db idp                                  # database + Keycloak
(cd backend && dotnet run --project src/TacticalBoard.Api)   # backend on :5080 (Development settings)
(cd frontend && pnpm run dev)                                # http://localhost:5173
```

The dev server proxies `/api` and `/auth` to `http://localhost:5080` (override with `TACTICALBOARD_BACKEND`), so the session cookie stays on its origin. Log in as `trainer` / `trainer` (system administrator) or `player` / `player`.

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

`appsettings.Development.json` points at the Compose database on `localhost:5432` and the Compose Keycloak on `localhost:8180` (start it too for the login: `docker compose up -d db idp`). Its public URL is the Vite dev server (`http://localhost:5173`), so the login returns there; to log in against the backend directly on `:5080`, set `App__PublicBaseUrl=http://localhost:5080`.

**Configuration** is done through environment variables (`ConnectionStrings__TacticalBoard`, `App__PublicBaseUrl`, `Oidc__Authority`, `Oidc__ClientId`, `Oidc__ClientSecret`, `Session__SecureCookies`, `DataProtection__KeysDirectory`, `Bootstrap__SystemAdministrators`, …); the full list is in [arc42 ch. 7](docs/arc42/07_deployment_view.md). The backend works with any standard OpenID Connect provider; how login, session and CSRF protection work is described in [arc42 ch. 8.13](docs/arc42/08_crosscutting_concepts.md). Migrations are applied when the backend starts (unless `Database__MigrateOnStartup=false`).

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
| App login (test users in the realm `tacticalboard`) | `trainer` / `trainer` (configured as system administrator), `player` / `player` |
| OIDC client for the backend | client ID `tacticalboard`, secret `tacticalboard-dev-secret`, issuer `http://localhost:8180/realms/tacticalboard` (containers reach Keycloak at `http://idp:8080`), redirect URIs `http://localhost:{8080,5080,5173}/auth/callback` |

Open http://localhost:8080 and click **Log in** on the start page. Keycloak runs in dev mode and keeps no data: the realm is re-imported from `deploy/keycloak/tacticalboard-realm.json` when its container is recreated. The users have fixed IDs, so the backend's bootstrap configuration (`trainer` as system administrator) stays valid. Sessions survive a backend restart (the key volume `backend-keys`).

Stop with `docker compose down`; `docker compose down -v` also deletes the volumes (database, session keys).

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
