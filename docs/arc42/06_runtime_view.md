# 6. Runtime View

Representative scenarios, based on the modules from chapter 5.

## 6.1 Login (backend for frontend)

The backend is the OIDC client (Authorization Code flow with PKCE). Tokens stay in the backend; the browser only gets an `HttpOnly` session cookie (ch. 8.13).

```mermaid
sequenceDiagram
    participant U as Trainer/Spieler
    participant F as Frontend (SvelteKit)
    participant B as Backend (.NET)
    participant I as Identity Provider
    participant DB as PostgreSQL

    U->>F: Click "Log in"
    F->>B: GET /auth/login?returnUrl=…
    B-->>U: Redirect to IdP (code + PKCE)
    U->>I: Authenticate
    I-->>B: Redirect to /auth/callback with code
    B->>I: Exchange code for tokens
    I-->>B: ID token (+ access/refresh token)
    B->>DB: Find user by issuer + subject, create on first login
    B-->>U: Set session cookie, redirect to returnUrl
    F->>B: GET /api/me (cookie)
    B-->>F: Current user (name, system admin flag)
```

A blocked or deleted user gets no session: the callback redirects to `/?login=failed` instead. Every later request with the session cookie checks the user again (ch. 8.13).

## 6.2 Save a team situation

```mermaid
sequenceDiagram
    participant U as Editor
    participant F as Frontend
    participant S as Backend: Situations
    participant A as Backend: Areas/Teams
    participant DB as PostgreSQL

    U->>F: Save (button or Ctrl+S)
    F->>S: PUT /api/situations/{id} (document), If-Match: "revision 7"
    S->>A: May the user write in this team? (Editor/Admin)
    A-->>S: Yes
    S->>DB: Current revision still 7? Title unique in the area?
    alt unchanged in between
        S->>DB: Insert revision 8, update metadata
        S-->>F: 200, ETag "revision 8"
    else someone saved revision 8 meanwhile
        S-->>F: 412 Precondition Failed (Problem Details: conflict)
        F-->>U: Warning: Overwrite / Save as copy / Cancel
    end
```

"Overwrite" repeats the save with the newest revision as `If-Match`; "Save as copy" creates a new situation with the title suffix " (2)" (or the next free number), see ch. 8.15.
