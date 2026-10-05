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
7. [x] **Membership**: join requests (accept/reject, re-request after rejection), roles and member management, member list, leaving, deleting a team (with confirmation). Also the step-6 follow-ups (product-owner decisions): non-members see only a team's name and logo (no code or link, also not in the overview), removing a logo no longer asks, and the deletion of a team's content is prepared as a contract chain that step 8 implements.
8. [ ] **Team situations and folders** with the permission matrix (ch. 8.1).
9. [ ] **System administration**: user list, block/unblock, delete users, grant/revoke system administrator, team management (incl. renaming a team and changing its logo — confirmed: system administrators may do that too, through `ITeamAuthorization.CanChangeDetailsAsync`).
10. [ ] **Account deletion** (by the user and by a system administrator), incl. the last-Admin rule.

## Later

- [ ] Additional sports
- [ ] Realtime collaborative editing (WebSockets, ADR-010)
- [ ] Version history of situations (the data model already keeps revisions)
- [ ] Restoring soft-deleted items; purging old data
- [ ] Helm chart for Kubernetes

## Open questions

- **Membership (step 7):** A rejected requester is not told about the rejection; their request is just no longer pending and the team's page offers "Ask to join" again. Should they see "Your request was rejected" (once, or until they ask again), or get any other notice?
- **Membership (step 7):** Admins may remove other Admins directly (as long as one Admin remains), like every other member. Is that wanted, or should an Admin have to be demoted first?
- **Membership (step 7):** Changing a role (also demoting oneself from Admin) takes effect at once, without a confirmation; only removing, leaving and deleting the team ask. Should demoting oneself (or any role change) ask first?
- **Membership (step 7):** The member list is sorted by display name. Should Admins (or roles in general) come first?
- **Membership (step 7):** Admins see the number of waiting join requests on the team's page and as a badge on the start page's team list. Is any other notice wanted (e.g. in the navbar)?
- **Membership (step 7):** The member list shows display names and roles only (no "member since", no e-mail). Is anything else wanted?
- **Membership (step 7):** A pending join request stays pending without a time limit. Should requests expire?

## Resolved questions (product-owner answers)

- **Teams (step 6):** Renaming a team and changing its logo: the team's **Admins and system administrators** — the system-administrator part is built with system administration (step 9).
- **Teams (step 6):** After "Create team" the new team's page opens — confirmed.
- **Teams (step 6):** Non-members see only a team's **name and logo**; its code and the link are not shown to them, neither on the team's page nor in the overview (the overview stays searchable by code), and the API doesn't send them the code — implemented in step 7.
- **Teams (step 6):** Removing a logo does **not** ask for confirmation — implemented in step 7; uploading a new one replaces the old one without asking, as before.

- **Localization (step 5):** The account's language is stored only when the user actively picks a language in the switcher; an account without a language keeps each browser's language — kept as implemented.
- **Localization (step 5):** A new situation's default title is stored in the UI language active at creation and is not translated later (user content) — confirmed.
- **Localization (step 5):** Technical details (the reason of a failed GIF export or share, field paths of server validation messages) may stay English inside localized messages — confirmed.
- **Numbered titles (step 5):** Numbering always counts upward from the highest number; gaps are not filled ("Powerplay (5)" → "Powerplay (6)" even if "Powerplay (2)" is free) — confirmed.
- **Folders in the editor (step 4 follow-ups):** An unsaved situation started in a folder counts as being in that folder: New/Load in the editor target it and the badge leads back to it — confirmed.
- **Empty folder (step 4 follow-ups):** An empty folder shows New situation / Import only in its empty state, the "Start in this folder" section hidden — confirmed.
