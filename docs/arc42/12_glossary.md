# 12. Glossary

| Term | Definition |
|---|---|
| Board | The drawable canvas showing one frame of a situation: players, ball, markers, and arrows. |
| Situation | The core saveable unit: a game scenario made of one or more frames, with title and description. A standard situation (e.g. a recorded free hit) is just a situation. Exportable/storable as JSON. |
| Frame | One step of a situation. A new frame starts as a copy of the current one (inserted after it); elements keep their identity across frames. |
| Frame strip | The numbered row of frame thumbnails below the board, used to switch, add, delete, and reorder frames. |
| Details panel | The panel next to (desktop), below (portrait tablet) or above (phones, collapsible) the board with the situation's title and description and the current frame's description. |
| Element | An item on a frame: a player, the ball, a marker, or an arrow. Has a stable ID that stays the same across the frames of a situation, so the same player in two frames is the same element. |
| Position label | Short text (at most 2 letters or digits) shown on a player, e.g. a position code like C (Center), LV (Linker Verteidiger), or a jersey number. Chosen from a predefined list per sport or typed freely; set per frame. |
| Marker | A generic shape (rectangle, triangle, circle) with no fixed meaning. |
| Arrow | An element showing a movement: a **pass** (dashed line), a **run** (wavy line), or a **shot** (thick line), drawn from a start to an end point with an arrowhead at the end. Free: not attached to players. Its type can only change to another arrow type. |
| Bend point | A point an arrow's curve passes through between its start and end. An arrow without bend points is straight; it can have any number of them, added, moved and removed by the user. |
| Team code | Unique, system-generated 6-character identifier of a team (A–Z, 0–9), used to find it. |
| Team | A group of users who share access to situations and folders, with per-member roles. Has a unique name, an optional logo and a team code. Its creator becomes its Admin. |
| Team logo | A team's optional image: uploaded as PNG, JPEG or WebP, stored scaled down to fit 256 × 256 px as PNG without metadata. |
| Team overview | The page `/teams` listing all teams (logo, name, code), searchable by name or code; for logged-in users. |
| Team page | A team's own page `/teams/<CODE>`, the link to share: name, logo, code, and for members their role. |
| Membership | A user's belonging to a team, with one role (Admin, Editor, Reader). |
| Area | Where saved situations live: a user's personal area or a team. Situation titles are unique within an area. |
| Personal area | A user's own area for situations and folders; only the user can access it. |
| Revision | One saved state of a situation on the server. Every save creates a new revision; the newest is the current one. Its number is the situation's ETag. |
| Saved situation (server situation) | A situation saved on the server, in an area. For it, "saved" means saved on the server, not exported. Shown in the editor at `/editor?situation=<id>`. |
| Save conflict | A save based on an older revision than the current one (someone else saved in between). The user chooses Overwrite, Save as copy or Cancel. |
| Default title | The title of a situation created with a blank title, in the UI language of that moment: "Untitled Situation", "Unbenannte Situation". Saved on the server, it is numbered within the area ("Untitled Situation (2)", …). |
| UI language | The language of the system texts (German or English, English the fallback); chosen in the navbar's language switcher, remembered in the browser and in the account. User content is never translated. |
| System text | A text the app itself shows (labels, buttons, messages, element type names, …), as opposed to user content (titles, descriptions, folder names, labels, display names). Only system texts are translated. |
| Navbar | The app's navigation bar at the top of the start page and the editor: badge (link to the start page; in the editor of a situation in a folder, to that folder's page), page title, the page's tools, and the account corner (Log in / the user's menu). |
| Soft delete | Deleting by marking an item as deleted instead of removing it from the database. |
| Local mode | Using the app without login: editing plus JSON/GIF export and import, nothing stored on the server. |
| Folder | Groups situations in a team or in a user's personal area. One level only, no subfolders. Its name is unique in the area and at most 64 characters long; it can be deleted only while empty. Has its own page (`/folders/<id>`); the start page lists it with the number of situations it contains. |
| Top level | The place in an area outside every folder. A situation is either in one folder of its area or at its top level. |
| Move | Putting a saved situation into another folder of its area (or to its top level) with its Move button. Not a save: no new revision. |
| Role | A team-scoped permission level: Admin, Editor, or Reader. See ch. 8 for the permission matrix. |
| System administrator | System-wide user type that manages users and teams (incl. members and roles), without access to situations or folders. Granted only by another system administrator, the first one through the deployment configuration. |
| Trainer | A coach-type user of the system. Descriptive only — not a role and not mapped to team roles. |
| Spieler | A player-type user of the system. Descriptive only — not a role and not mapped to team roles. |
| IdP (Identity Provider) | External OpenID Connect service handling authentication (any provider, e.g. PocketID, Keycloak). The backend does not store passwords itself. |
| BFF (backend for frontend) | The backend performs the OIDC login for the browser and keeps the tokens; the browser only holds a session cookie. |
