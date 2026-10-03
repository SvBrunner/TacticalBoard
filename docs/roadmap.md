# Roadmap

Phases in delivery order. Detailed requirements live in [arc42 chapter 1](arc42/01_introduction_and_goals.md); this file tracks what is done and what is next.

Phase 1 is ordered; later phases are not prioritized internally yet.

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
2. [ ] **Undo/redo** as commands on the model.
   *Every later feature then goes through commands from the start instead of being retrofitted.*
3. [ ] **Touch baseline**: place, move, select, and color popover by touch; responsive layout for phones and tablets.
   *Settles the interaction pattern before arrows. From here on, touch usability is a requirement for every step.*
4. [ ] **Create a new situation** with title and full/half field; **half field** rendering.
5. [ ] **Position labels** on players (C, F, V, G, …).
6. [ ] **Frames UI**: add frame (copy of the previous one), switch, delete; description per frame.
7. [ ] **Pass/run/shot arrows**: straight, bendable via a control point.
8. [ ] **Slideshow playback** of frames in the editor.
9. [ ] **GIF/video export** (frames as slideshow), reusing the playback logic.

## Phase 2 — Backend, users, and teams

Architecture decisions: .NET, PostgreSQL, self-hosted OIDC IdP, containers (see [ADRs](arc42/09_architecture_decisions.md)).

- [ ] Backend skeleton + IdP login
- [ ] System-wide user types: system administrator (operations only) and normal user
- [ ] Personal area: save/load/edit/delete situations on the server, in flat folders
- [ ] Teams: create (name, logo, generated 6-character code A–Z/0–9), overview page of all teams searchable by name/code, team links
- [ ] Join requests, accepted/rejected by team Admins; new members start as Reader
- [ ] Leaving a team (the last Admin has to delete the team instead)
- [ ] Member and role management (Admin, Editor, Reader — see [ch. 8](arc42/08_crosscutting_concepts.md))
- [ ] Team situations in flat folders
- [ ] Default titles are incremented (Untitled Situation 2, …)

## Later

- [ ] Additional sports

## Open questions

_None at the moment._
