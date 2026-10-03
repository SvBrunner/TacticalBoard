# 12. Glossary

| Term | Definition |
|---|---|
| Board | The drawable canvas showing one frame of a situation: players, ball, markers, and arrows. |
| Situation | The core saveable unit: a game scenario made of one or more frames, with title and description. A standard situation (e.g. a recorded free hit) is just a situation. Exportable/storable as JSON. |
| Frame | One step of a situation. A new frame starts as a copy of the previous one; elements keep their identity across frames. |
| Marker | A generic shape (rectangle, triangle, circle) with no fixed meaning. |
| Team code | Unique, system-generated 6-character identifier of a team (A–Z, 0–9), used to find it. |
| Team | A group of users who share access to boards and folders, with per-member roles. |
| Folder | Groups situations in a team or in a user's personal area. One level only, no subfolders. |
| Role | A team-scoped permission level: Admin, Editor, or Reader. See ch. 8 for the permission matrix. |
| System administrator | System-wide user type limited to operations/technical settings; no special access to teams or content. |
| Trainer | A coach-type user of the system. Descriptive only — not a role and not mapped to team roles. |
| Spieler | A player-type user of the system. Descriptive only — not a role and not mapped to team roles. |
| IdP (Identity Provider) | External, self-hosted service handling authentication (e.g. PocketID, Keycloak). The backend does not store passwords itself. |
