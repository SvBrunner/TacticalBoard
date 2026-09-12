# 7. Deployment View

Single self-hosted deployment (per the constraints in ch. 2: containerized, self-hostable, reverse proxy assumed).

```mermaid
graph TB
    subgraph "Self-hosted server"
        RP[Reverse Proxy<br/>TLS termination]
        FE[Frontend container<br/>SvelteKit]
        BE[Backend container<br/>.NET REST API]
        DB[(PostgreSQL container)]
        IdP[IdP container<br/>e.g. PocketID / Keycloak]

        RP --> FE
        RP --> BE
        RP --> IdP
        BE --> DB
        BE --> IdP
    end

    Browser((Browser)) -- HTTPS --> RP
```

_TBD: container orchestration (plain Docker Compose vs. Kubernetes vs. something else) — not yet decided. Docker Compose is the likely default for a self-hosted, solo-maintained deployment, but not confirmed._
