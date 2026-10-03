# 6. Runtime View

Two representative scenarios, based on the modules from chapter 5.

## 6.1 Login

_Assumes OAuth2 Authorization Code flow (with PKCE) against the self-hosted IdP — a common default for SPA + external IdP, not yet explicitly confirmed._

```mermaid
sequenceDiagram
    participant U as Trainer/Spieler
    participant F as Frontend (SvelteKit)
    participant I as Identity Provider
    participant B as Backend (.NET)

    U->>F: Open app
    F->>I: Redirect to login (Authorization Code + PKCE)
    U->>I: Enter credentials
    I-->>F: Redirect back with auth code
    F->>I: Exchange code for tokens
    I-->>F: Access token (+ refresh token)
    F->>B: REST call with access token
    B->>I: Validate token (e.g. JWKS)
    B-->>F: Response (authorized)
```

## 6.2 Save a board

```mermaid
sequenceDiagram
    participant U as Trainer
    participant F as Frontend (SvelteKit)
    participant B as Backend: Boards module
    participant T as Backend: Teams module
    participant DB as PostgreSQL

    U->>F: Click "Save"
    F->>B: POST /boards (JSON board content, folder, team)
    B->>T: Check user's role in team (Editor/Admin required)
    T-->>B: Authorized
    B->>DB: Persist board
    DB-->>B: OK
    B-->>F: 201 Created
    F-->>U: Confirmation
```

