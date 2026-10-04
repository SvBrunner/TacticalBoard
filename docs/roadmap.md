# Roadmap

Phases in delivery order. Detailed requirements live in [arc42 chapter 1](arc42/01_introduction_and_goals.md); this file tracks what is done and what is next.

Phase 1 is ordered and complete; later phases are not prioritized internally yet.

## Phase 1 — MVP: board editor (frontend only, floorball)

Situations are stored locally only (JSON export/import).

Done:

- [x] Floorball full field
- [x] Place, move, and color players, ball, and generic markers
- [x] JSON export/import (single board)
- [x] Light/dark theme

Next, in this order:

1. [x] **Situation data model**: situation → frames → elements with stable IDs; title, situation and frame descriptions, field type (full/half). Versioned JSON format; switch export/import to it.
   *Everything else builds on this; changing it later touches every feature and already-exported files.*
2. [x] **Undo/redo** as commands on the model.
   *Every later feature then goes through commands from the start instead of being retrofitted.*
3. [x] **Touch baseline**: place, move, select, and color popover by touch; responsive layout for phones and tablets.
   *Settles the interaction pattern before arrows. From here on, touch usability is a requirement for every step.*
4. [x] **Create a new situation** with title and full/half field; **half field** rendering.
5. [x] **Position labels** on players (C, F, V, G, …).
6. [x] **Frames UI**: add frame (copy of the previous one), switch, delete, reorder; description per frame; situation details panel.
7. [x] **Pass/run/shot arrows**: straight, bendable via any number of bend points.
8. [x] **Slideshow playback** of frames in the editor.
9. [x] **GIF export** (frames as slideshow), reusing the playback timing and the board drawing.

## Phase 2 — Backend, users, and teams

Architecture decisions: .NET modular monolith, PostgreSQL, any OIDC IdP with BFF login, Docker Compose (see [ADRs](arc42/09_architecture_decisions.md) and [ch. 8.13–8.17](arc42/08_crosscutting_concepts.md)). Local mode without login stays available throughout.

Next, in this order:

1. [x] **Backend skeleton**: .NET 10 solution with the modules from ch. 5.2, DI, EF Core + PostgreSQL with migrations, Problem Details, health endpoint; xUnit + Testcontainers; .NET SDK in the Nix flake; Docker Compose with backend, PostgreSQL, a development IdP, reverse proxy and the frontend switched to `adapter-static`.
   *Everything else runs on it; settles the module boundaries and the test setup.*
2. [ ] **Login**: BFF login/logout, session cookie, CSRF, just-in-time users, display name (editable), `/api/me`, bootstrap system administrator; frontend shows log in/out and keeps local mode.
3. [ ] **Personal area — situations**: save (button, Ctrl+S), open, delete; revisions and metadata, title uniqueness and default titles, conflict warning (overwrite / save as copy), created/changed by; the start page lists the saved situations.
   *First real use of the backend; establishes the save flow that teams reuse.*
4. [ ] **Personal area — folders**: create, rename (unique names), delete (only if empty); situations in folders or at the top level, moving them between folders; "New situation"/"Import" from a folder saves there.
5. [ ] **Teams**: create (unique name, optional logo, generated code), overview page with search (logged in), team page via link; the start page lists the user's teams.
6. [ ] **Membership**: join requests (accept/reject, re-request after rejection), roles and member management, member list, leaving, deleting a team (with confirmation).
7. [ ] **Team situations and folders** with the permission matrix (ch. 8.1).
8. [ ] **System administration**: user list, block/unblock, delete users, grant/revoke system administrator, team management.
9. [ ] **Account deletion** (by the user and by a system administrator), incl. the last-Admin rule.

## Later

- [ ] Additional sports
- [ ] Realtime collaborative editing (WebSockets, ADR-010)
- [ ] Version history of situations (the data model already keeps revisions)
- [ ] Restoring soft-deleted items; purging old data
- [ ] Helm chart for Kubernetes

## Open questions

_None at the moment._
