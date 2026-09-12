# 4. Solution Strategy

## Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | SvelteKit + Svelte 5 | Already established (see git history). |
| Drawing canvas | Konva / svelte-konva | Already established. |
| Backend | .NET | Developer's existing experience and preference. |
| Database | PostgreSQL | Chosen default; the backend's data-access layer is designed to be swappable (e.g. via a repository/abstraction layer), so the database is not a hard dependency of the rest of the system. |
| API style | REST over HTTPS | See chapter 3. WebSockets are being considered in addition, for realtime use cases — not yet decided. |
| Authentication | Delegated to a self-hosted OpenID Connect Identity Provider (candidates: PocketID, Keycloak) | Avoids building and maintaining custom auth; keeps the system self-hostable per chapter 2 (no dependency on a SaaS identity provider). |

## How this serves the quality goals and constraints

- **Self-hostable / no vendor lock-in** (ch. 2): PostgreSQL, and the .NET backend, all run in self-managed containers; auth uses a self-hostable IdP instead of a SaaS provider.
- **Database swappability**: the backend isolates data access behind an abstraction so PostgreSQL is a default, not a hard-wired assumption — supports longer-term maintainability without over-engineering for a need that doesn't exist yet.
