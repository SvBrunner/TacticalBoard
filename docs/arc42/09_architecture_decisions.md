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

- **Status**: Accepted (specific IdP product not yet chosen — candidates: PocketID, Keycloak)
- **Context**: Need login/authentication that stays self-hostable (ch. 2), without building and maintaining custom auth.
- **Decision**: Delegate authentication to an external, self-hosted OpenID Connect Identity Provider. The backend validates tokens issued by it.
- **Consequences**: Deployment must include (or point to) an IdP instance. The backend needs no password storage of its own.

## ADR-004: Containerized, self-hosted deployment; no SaaS vendor lock-in

- **Status**: Accepted
- **Context**: The app must be runnable by someone other than the original developer, on their own infrastructure.
- **Decision**: Ship as OCI containers; avoid dependencies on proprietary managed cloud services for auth, database, or storage.
- **Consequences**: Every required external dependency (DB, IdP) must itself be self-hostable.
