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
8. [x] **Team situations and folders** with the permission matrix (ch. 8.1): every member sees the team's folders and situations on the team's page and the team folders' pages; Admins and Editors create, edit, move and delete them and create, rename and delete folders, exactly as in the personal area; Readers only open (read-only in the editor), play back and export; system administrators have no access as such. Deleting a team deletes its folders and situations. No moving or copying between areas (only export/import). Also the step-7 follow-ups (product-owner decisions): giving oneself a lower role asks first, and the member list shows Admins, then Editors, then Readers, each by name.
9. [ ] **System administration**: user list, block/unblock, delete users, grant/revoke system administrator, team management (incl. renaming a team and changing its logo — confirmed: system administrators may do that too, through `ITeamAuthorization.CanChangeDetailsAsync`).
10. [ ] **Account deletion** (by the user and by a system administrator), incl. the last-Admin rule.

Alongside (product-owner request):

- [x] **CI and deployable images**: GitHub Actions CI on every push and pull request (frontend check/test/build, backend build and unit + integration tests, image test builds); after CI passes on `master` and on `vX.Y.Z` tags, backend and frontend images for amd64 and arm64 are pushed to `ghcr.io/svbrunner/tacticalboard-{backend,frontend}` (ADR-016). A production Compose example (`deploy/production/`) and the operator guide [deployment.md](deployment.md).

## Later

- [ ] Additional sports
- [ ] Realtime collaborative editing (WebSockets, ADR-010)
- [ ] Version history of situations (the data model already keeps revisions)
- [ ] Restoring soft-deleted items; purging old data
- [ ] Helm chart for Kubernetes
- [ ] Notifications (e.g. e-mail or push) for join requests — not built yet (product-owner decision, step 7); the join requests are stored with their timestamps, so a later notifier can be added without changing them

## Open questions

- **Team situations (step 8):** May a Reader edit a team situation locally, without saving (e.g. to try something out, then export it)? Implemented conservatively: the editor opens team situations **read-only** for Readers (like during playback); playback, frame switching and the JSON/GIF export stay available. Should Readers be able to change it locally (never saving it to the team)?
- **Team situations (step 8):** In the editor of a team situation a Reader may only view, **New** and **Load** start at the top level of the **personal area** (not in the team, where they can't save); the badge still leads back to the team's folder or page. Is that the wanted target?
- **Team situations (step 8):** A role change takes effect for content with the next request, but an open editor isn't told: a member demoted to Reader while editing gets "You may not change this situation (any more)…" when saving (and can export); a Reader promoted meanwhile has to open the situation again to edit it. Is a live update wanted?
- **Team situations (step 8):** A team's situations and folders are shown on the team's page below the team's details (before the member list), for every member. Is another place or order wanted (e.g. a tab, or the situations first)?
- **Team situations (step 8):** A system administrator who is also a member of a team has that member's access to the team's content (by their role); only a system administrator *without* a membership has none. Confirm?
- **Team situations (step 8):** Team situations aren't listed on the start page (only on their team's page). Should the start page also show, e.g., recently changed team situations?

## Resolved questions (product-owner answers)

- **Membership (step 7):** A rejected requester is **not** notified; the team's page simply offers "Ask to join" again — kept.
- **Membership (step 7):** An Admin may remove another Admin directly (as long as one Admin remains) — kept.
- **Membership (step 7):** Giving **oneself a lower role** (self-demotion) asks for confirmation first; every other role change happens at once — implemented in step 8.
- **Membership (step 7):** The member list shows **Admins first, then Editors, then Readers**, each by display name (deleted users last within their role) — implemented in step 8 (ordered by the backend).
- **Membership (step 7):** No further notice of pending join requests for now (the count on the team's page and the start page stays); a later integration (e.g. e-mail or push) must remain possible — added to "Later".
- **Membership (step 7):** The member list shows only display name and role — kept.
- **Membership (step 7):** Pending join requests don't expire — kept.

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
