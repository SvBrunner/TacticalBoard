# 9. Architecture Decisions

Significant decisions, recorded as lightweight ADRs.

## ADR-001: Backend technology is .NET

- **Status**: Accepted
- **Context**: Needed a backend technology for the REST API and business logic.
- **Decision**: Use .NET.
- **Rationale**: Developer's existing experience and preference — no deeper technical driver.
- **Consequences**: Backend tooling, hosting, and CI need a .NET runtime/container base image.

## ADR-002: PostgreSQL as default database, behind a swappable data-access layer

- **Status**: Accepted
- **Context**: Needed a self-hostable database (ch. 2) as the default persistence choice.
- **Decision**: Use PostgreSQL, accessed only through a data-access abstraction inside the backend.
- **Rationale**: PostgreSQL is a solid, self-hostable default; isolating data access keeps the door open to swapping it later without a design that hard-codes Postgres-specific assumptions elsewhere.
- **Consequences**: No feature may depend on Postgres-specific behavior outside the data-access layer.

## ADR-003: Authentication delegated to a self-hosted OIDC Identity Provider

- **Status**: Accepted
- **Context**: Need login/authentication that stays self-hostable (ch. 2), without building and maintaining custom auth.
- **Decision**: Delegate authentication to an external OpenID Connect Identity Provider. The system is **not tied to a product**: it works with any standard OIDC provider (e.g. PocketID, Keycloak, Authentik), self-hosted or not. Every valid login from the configured provider becomes a normal user; who may register is configured in the IdP.
- **Consequences**: Deployment must point to an IdP instance (the local Compose setup brings a development IdP). The backend needs no password storage of its own. Users are identified by issuer + subject, never by e-mail.

## ADR-004: Containerized, self-hosted deployment; no SaaS vendor lock-in

- **Status**: Accepted
- **Context**: The app must be runnable by someone other than the original developer, on their own infrastructure.
- **Decision**: Ship as OCI containers; avoid dependencies on proprietary managed cloud services for auth, database, or storage.
- **Consequences**: Every required external dependency (DB, IdP) must itself be self-hostable.

## ADR-005: Docker Compose now, Helm later

- **Status**: Accepted
- **Context**: The stack (frontend, backend, PostgreSQL, IdP) has to be started locally and self-hosted.
- **Decision**: Docker Compose for local development and simple deployments. A Helm chart for Kubernetes comes later.
- **Consequences**: Configuration only through environment variables and volumes, so the same images run under Compose and Kubernetes.

## ADR-006: Login as backend for frontend (BFF), session cookie

- **Status**: Accepted
- **Context**: A browser app needs to call the API as the logged-in user. Options: tokens in the browser (public client, JWT bearer), or the backend as OIDC client with a cookie session (BFF).
- **Decision**: BFF. The backend runs the Authorization Code flow with PKCE, keeps the tokens, and gives the browser an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. State-changing requests additionally need an antiforgery header.
- **Rationale**: Tokens are out of reach of injected JavaScript (XSS); refresh and logout are handled server-side; this is what the current OAuth guidance for browser-based apps recommends. Frontend and API share one origin anyway (ch. 7).
- **Consequences**: CSRF protection is required (ch. 8.13). Other clients (e.g. native apps) can later be supported by also accepting JWT bearer tokens; both schemes can coexist. The frontend knows only `/auth/login`, `/auth/logout` and `/api/me`, so the backend remains replaceable.

## ADR-007: Modular monolith, dependency injection, swappable infrastructure

- **Status**: Accepted
- **Context**: Solo project; the backend should be easy to run, but its parts (database, identity) replaceable.
- **Decision**: One deployable backend, split into modules by domain (ch. 5.2). Domain and application code depend only on interfaces (repositories, clock, ID/code generators, current user); implementations are registered through ASP.NET Core dependency injection. EF Core with Npgsql is the only implementation of the repositories.
- **Consequences**: Domain logic is unit-testable without a database. A module may use another only through its public interfaces.

## ADR-008: Static frontend build

- **Status**: Accepted
- **Context**: The editor already runs client-side only (Konva, ch. 8); the backend owns all server logic.
- **Decision**: Build the frontend with `adapter-static` (SPA fallback) and serve it from a small web server container.
- **Consequences**: No Node server in production. The start page loses server rendering, which brings no benefit behind a login anyway.

## ADR-009: Situations stored as JSON document plus metadata, with revisions

- **Status**: Accepted
- **Context**: Situations already have a versioned JSON file format (ch. 8.3). The server needs to list, sort and search them, and versioned storage may come later.
- **Decision**: Every save stores the complete situation document (always in the current format version) as a new **revision** row (`jsonb`). The situation row holds the metadata as ordinary columns: area, folder, title, field type, sport, format version, created/updated at and by, the current revision number, deleted at. Only the current revision is used in Phase 2; there is no UI for older revisions.
- **Rationale**: One format for files and server, no mapping of frames and elements to tables; the revision table makes later version history and realtime editing possible without a data migration.
- **Consequences**: The frontend migrates older file versions before uploading; the backend validates the current format only. The revision number is the concurrency token (ETag). Storage grows with every save (acceptable at this scale; pruning can come later).

## ADR-010: Realtime after Phase 2, without blocking it

- **Status**: Accepted
- **Context**: Collaborative editing over WebSockets is wanted, but not in Phase 2.
- **Decision**: Phase 2 is REST only. It must not block realtime later: stable element IDs, edits as commands (already in the frontend), domain services independent of the transport, revision numbers on situations, and a session cookie that also works for a WebSocket connection on the same origin.
- **Consequences**: No transport-specific logic in the domain modules.

## ADR-011: Backend testing

- **Status**: Accepted
- **Decision**: Unit tests have priority (xUnit, domain and application services against fakes of the interfaces). Integration tests with Testcontainers (real PostgreSQL) cover repositories, migrations and the HTTP API in addition.
- **Consequences**: The Nix flake provides the .NET SDK; integration tests need a container runtime.
