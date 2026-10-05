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
2. [x] **Login**: BFF login/logout, session cookie, CSRF, just-in-time users, display name (editable), `/api/me`, bootstrap system administrator; frontend shows log in/out and keeps local mode.
3. [x] **Personal area — situations**: save (button, Ctrl+S), open, delete; revisions and metadata, title uniqueness and default titles, conflict warning (overwrite / save as copy), created/changed by; the start page lists the saved situations.
   *First real use of the backend; establishes the save flow that teams reuse.*
4. [x] **Personal area — folders**: create, rename (unique names), delete (only if empty); situations in folders or at the top level, moving them between folders; "New situation"/"Import" from a folder saves there. Follow-ups (product-owner decisions): names up to 64 characters, the folder list shows each folder's situation count, an empty folder offers New situation / Import in its empty state, the editor's New / Load save into the edited situation's folder and its badge leads back to the folder.
5. [x] **Localization**: German and English (English the fallback; another language needs only a new translation file); all system texts translated, user content never; the browser's language at the start, a language switcher in the navbar, remembered in the browser and in the account (the account's language wins on login); the backend sends stable error codes (also per invalid field) that the frontend words. Plus the step-3 follow-ups: an export no longer counts as saved while logged in, numbered titles are numbered on ("Powerplay (2)" → "Powerplay (3)"), Save is disabled without unsaved changes.
   *Before teams, so every later screen is built translatable from the start.*
6. [x] **Teams**: create (unique name, optional logo, generated code), overview page with search (logged in), team page via link; the start page lists the user's teams. Also: the creator becomes Admin; Admins rename the team and set/replace/remove its logo; logos are scaled to fit 256 × 256 px and stored without metadata (ADR-014).
7. [ ] **Membership**: join requests (accept/reject, re-request after rejection), roles and member management, member list, leaving, deleting a team (with confirmation).
8. [ ] **Team situations and folders** with the permission matrix (ch. 8.1).
9. [ ] **System administration**: user list, block/unblock, delete users, grant/revoke system administrator, team management.
10. [ ] **Account deletion** (by the user and by a system administrator), incl. the last-Admin rule.

## Later

- [ ] Additional sports
- [ ] Realtime collaborative editing (WebSockets, ADR-010)
- [ ] Version history of situations (the data model already keeps revisions)
- [ ] Restoring soft-deleted items; purging old data
- [ ] Helm chart for Kubernetes

## Open questions

- **Teams (step 6):** Renaming a team and changing its logo are not in the permission matrix (ch. 8.1); they are implemented as **Admin-only**. Should Editors (or system administrators) be allowed to as well?
- **Teams (step 6):** After "Create team" on the start page the new team's page opens (to see and share its code). Is that wanted, or should the start page stay with the list updated?
- **Teams (step 6):** A non-member sees a team's name, logo, code and link (the overview shows every team to every logged-in user anyway). Should anything of a team stay hidden from non-members?
- **Teams (step 6):** Removing a logo asks "Remove logo?" first; uploading a new one replaces the old one without asking. Is that the wanted behavior?

## Resolved questions (product-owner answers)

- **Localization (step 5):** The account's language is stored only when the user actively picks a language in the switcher; an account without a language keeps each browser's language — kept as implemented.
- **Localization (step 5):** A new situation's default title is stored in the UI language active at creation and is not translated later (user content) — confirmed.
- **Localization (step 5):** Technical details (the reason of a failed GIF export or share, field paths of server validation messages) may stay English inside localized messages — confirmed.
- **Numbered titles (step 5):** Numbering always counts upward from the highest number; gaps are not filled ("Powerplay (5)" → "Powerplay (6)" even if "Powerplay (2)" is free) — confirmed.
- **Folders in the editor (step 4 follow-ups):** An unsaved situation started in a folder counts as being in that folder: New/Load in the editor target it and the badge leads back to it — confirmed.
- **Empty folder (step 4 follow-ups):** An empty folder shows New situation / Import only in its empty state, the "Start in this folder" section hidden — confirmed.
