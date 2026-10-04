# 4. Solution Strategy

## Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | SvelteKit + Svelte 5, built as a static app (`adapter-static`) | Already established. A static build is served by a plain web server container behind the same reverse proxy as the API (ADR-008). |
| Drawing canvas | Konva / svelte-konva | Already established. |
| Backend | .NET 10, ASP.NET Core, modular monolith | Developer's experience and preference (ADR-001); modules by business domain (ch. 5, ADR-007). |
| Database | PostgreSQL via EF Core (Npgsql) | Chosen default; data access sits behind repository interfaces wired by dependency injection, so the database is not a hard dependency of the rest of the system (ADR-002, ADR-007). |
| API style | REST over HTTPS, errors as RFC 7807 Problem Details | See ch. 3 and 8.2. WebSockets follow after Phase 2 (ADR-010). |
| Authentication | Any OpenID Connect Identity Provider; the backend runs the login as a backend for frontend (BFF) with a session cookie | No own auth; tokens never reach the browser (ADR-003, ADR-006). |
| Situation storage | The situation as a JSON document (current file format) plus metadata columns, every save as a new revision | One format for files and server; versioning possible later without a migration (ADR-009). |
| Deployment | OCI containers; Docker Compose now, a Helm chart later | ADR-004, ADR-005. |
| Testing | Backend: unit tests first (xUnit), integration tests with Testcontainers (real PostgreSQL) in addition | ADR-011. |

## How this serves the quality goals and constraints

- **Self-hostable / no vendor lock-in** (ch. 2): PostgreSQL and the .NET backend run in self-managed containers; auth works with any standard OIDC provider, self-hosted or not.
- **Swappability**: the domain logic depends only on interfaces (repositories, clock, ID generation, identity); infrastructure (EF Core/PostgreSQL, OIDC) is plugged in through dependency injection. The frontend knows only the REST API and the login/logout URLs, so the backend implementation can be replaced.
