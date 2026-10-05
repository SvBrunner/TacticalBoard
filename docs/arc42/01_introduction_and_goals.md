# 1. Introduction and Goals

## 1.1 Requirements Overview

**Functional requirements**

Delivery order: the board editor is the MVP and ships first, with local JSON export/import only. Server-side storage, users, and teams follow afterwards (see [roadmap](../roadmap.md)).

*Situations (MVP)*
- A situation is the single core unit. A "standard situation" (e.g. a free hit recorded once and recalled later) is not a separate concept; technically it is an ordinary situation.
- Only floorball is supported for now. The data model stays sport-agnostic so other sports can be added later.
- A situation has a title and a description. The title is optional: a new situation created with a blank title gets the default title as its real title — in the UI language of that moment ("Untitled Situation", "Unbenannte Situation"; see *Languages*) — and a blank title (e.g. from an imported file) is shown as the default title of the current UI language. When it is saved on the server, default titles are incremented within the area ("Untitled Situation (2)", …, see *Server-side storage*).
- Situation and frame descriptions are Markdown source text.
- A situation records when it was created and last updated (`createdAt`/`updatedAt`); both are part of the exported file. Every edit refreshes `updatedAt`.
- A situation uses either the full field or half the field. This is chosen when the situation is created and applies to all its frames. The full field is shown in landscape; the half field in portrait, with its goal at the bottom. Which half is used doesn't matter to the user.
- Creating a new situation asks only for the title and full/half field (no description).
- A situation consists of one or more ordered **frames**. A new frame is inserted right after the current frame as a copy of it, including its description, and becomes the current frame; elements keep their identity (same ID) across frames. After that the frames are independent: a change in one frame never propagates to another. There is no limit on the number of frames.
- Frames are shown numbered, with a thumbnail preview, and can be switched, added, deleted (after a confirmation; the last remaining frame can't be deleted), and reordered by drag and drop (also by touch). Adding, deleting and reordering frames are not undoable.
- Each frame has its own description text. The situation's title and description are edited in a details panel (collapsible on phones). Descriptions are edited as Markdown source; rendering them comes later.
- Frames can be played back as a slideshow (one after another, no interpolated movement) in the editor.

*Board editor (MVP)*
- Elements: players, ball, generic markers (rectangle, triangle, circle — no fixed meaning; the user interprets them).
- Players are labelled with a position abbreviation (e.g. C, F, V, G).
- Every element can be colored freely. There is no built-in team/side concept.
- Pass, run, and shot arrows: drawn as straight arrows (start + end, by press-and-drag or by tapping start and end) and can afterwards be bent into a smooth curve through any number of bend points, which can be moved and removed again. The three types differ in line style (pass dashed, run wavy, shot thick); all have the same arrowhead at the end. Arrows are free (not attached to players), have no label, are always drawn below players and markers, and are copied into a new frame like every other element.
- Undo/redo.
- Export a situation as JSON, and import it again. Importing always creates a new situation (new situation ID, `createdAt`/`updatedAt` set to the import time; frame and element IDs are kept) and replaces the editor content.
- The app opens on a start page offering "New situation" and "Import"; both lead into the editor. When logged in, the start page also shows the personal area: its folders (create; each opens its own page and shows how many situations it contains) and the situations at its top level (open, move to a folder, delete); and the user's teams (logo, name, code, their role, and for the teams they are Admin of the number of pending join requests) with "Create team" and a link to the team overview. A folder's page offers "New situation" and "Import" into that folder, its situations (open, move, delete), and renaming and deleting the folder (only there, not in the start page's list). An empty folder offers "New situation" and "Import" only in its empty state; the separate "Start in this folder" section is hidden then (confirmed).
- Both the start page and the editor have the app's navigation bar: the app badge (back to the start page; in the editor, while the edited situation lies in a folder, back to that folder's page), the page title, and the account corner ("Log in", or the user's menu).
- Unsaved changes (in local mode, i.e. not logged in: not exported since the last edit; when logged in, and for a situation saved on the server: not saved on the server since the last edit — an export doesn't count then, confirmed product decision) are protected: starting a new situation, importing, or going back to the start page or the folder's page (the badge in the editor header) asks "Discard changes?" first, and leaving or reloading the page triggers the browser's warning.
- Export a situation as an animated GIF (frames as a slideshow, looping), at a selectable resolution, with the playback frame duration; on phones also shareable through the native share sheet.
- Fully usable by touch on phones and tablets, not only on desktop.

*Languages (Phase 2)*
- The UI is available in **German and English**; English is the fallback. Adding a language must only need a new translation file.
- Only **system texts** are translated: labels, buttons, dialogs, hints, accessible names and tooltips, validation and error messages, default texts the UI shows, the GIF/JSON export UI, the playback controls, the names of element types, colors and predefined positions. **User content** — titles, descriptions, folder names, labels typed by users, display names — is never translated.
- The language starts as the browser's language (de\* → German, otherwise English). A language switcher in the shared navbar changes it at once; the choice is remembered in the browser and, when logged in, also stored in the user account — only when the user actively picks a language; an account that never picked one keeps each browser's language (confirmed). On login the account's language wins.
- Errors from the server are shown in the UI language: the server reports stable error codes, the app words them. Technical details inside such a message (e.g. the browser's reason for a failed GIF export, the field path of a validation error) may stay English (confirmed).
- A default title is stored in the language active when the situation is created and is not translated later (it is user content from then on; confirmed).

*Accounts (after MVP)*
- Login goes through any OpenID Connect Identity Provider. The system accepts every valid login from the configured IdP and creates a **normal user** on the first login; who may register is decided in the IdP, not in the app.
- Without login the app stays usable locally, exactly as in the MVP: create, edit, JSON export/import, GIF export. Saving on the server needs a login.
- The display name is taken from the IdP on the first login and can then be changed in the app. Later logins never overwrite it. If the IdP sends no name at all (no `name`, `preferred_username` or `email`), the display name is "User".
- A blocked user who logs in gets no session and sees "Account blocked." (any other failed login only shows "Login failed.").
- After an account was deleted, the same IdP identity may log in again: it then gets a **new, empty** account (nothing of the deleted account comes back).
- Deleting an account deletes everything that cannot exist without it: the personal area with its folders and situations, the team memberships and pending join requests. While the user is the **last Admin of a team that has other members**, the account can't be deleted; they have to make someone else Admin first (or delete the team). A team in which they are the only member is deleted with the account.

*Server-side storage (after MVP)*
- Save, load, edit, and delete situations on the server. Saving is explicit: a Save button and Ctrl+S (Cmd+S); there is no autosave. The Save button is disabled while there are no unsaved changes (Ctrl+S then does nothing); a situation never saved on the server counts as having changes, so it can always be saved. Saved situations are opened from (and deleted in, after a confirmation) the lists on the start page and on the folders' pages.
- Every user has a personal area for situations, in addition to the teams they belong to.
- Both the personal area and teams group their situations into folders. Folders are flat (one level, no subfolders) and can be created, renamed and deleted. A situation does not have to be in a folder; it can also sit at the top level of its area, and it can be moved between the folders (and the top level) of its area. Folder names are unique within an area (like titles: ignoring upper/lower case and surrounding spaces) and at most 64 characters long. Folders are listed by name (ignoring upper/lower case), each with the number of situations it contains. A folder that still contains situations can't be deleted; trying it says why. Moving a situation doesn't count as a change of it.
- A new or imported situation is saved where it was started: in the area and folder (or top level) from which "New situation" or "Import" was chosen. Started from the start page, it is saved at the top level of the personal area (without login it can only be exported, as in local mode). Started with New or Load in the editor, it is saved in the folder of the situation being edited there (the top level if that one is in no folder, or in local mode). An unsaved situation started in a folder already counts as being in that folder: New/Load in the editor target it and the badge leads back to it (confirmed). A copy saved after a conflict goes into the original's folder.
- Situation titles are **unique within an area** (a team, or one user's personal area), ignoring upper/lower case. Saving under a title that already exists there is rejected with an error. An imported situation whose title already exists gets the suffix " (2)" (or the next free number) instead. A title that already ends with " (n)" is numbered on instead of getting a second suffix: a copy or import of "Powerplay (2)" becomes "Powerplay (3)" (or the next free number after it); the same holds for default titles. Numbering always counts upward from the highest number; gaps are not filled (confirmed).
- Default titles are incremented within the area (Untitled Situation (2), …).
- If two people edit the same situation and the second one saves after the first, the second gets a warning and chooses: **overwrite** the other version, or **save as a copy** (title with " (2)" or the next free number).
- A saved situation shows who created it and who changed it last, and when. For a deleted account it shows "Deleted user".
- There is no direct move/copy of situations between the personal area and a team (or between teams). Copying works only through JSON export and import.
- Nothing is deleted physically: deleting a situation, folder, team or account is a **soft delete**. There is no UI to restore deleted data yet and no final purge. Titles and team names of deleted items can be reused.

*Users and teams (after MVP)*
- There are two system-wide user types: **system administrators** and **normal users**. Only a system administrator can make another user a system administrator (or take that role away); the last system administrator can't lose the role. The first system administrator is set up through the deployment configuration (see ch. 8).
- System administrators manage **users** (block, delete, grant/revoke system administrator) and **teams** (delete a team, manage its members and roles). They have **no access to situations or folders**, neither in personal areas nor in teams.
- Any user can create a team; its creator becomes its Admin. A team has a unique name (ignoring upper/lower case and surrounding spaces; at most 64 characters, a technical limit like folder names), an optional logo (at most 256 × 256 px: an uploaded PNG, JPEG or WebP image is scaled down to fit and stored without its metadata; SVG is not accepted), and a unique 6-character identifier code, generated by the system from uppercase letters and digits (A–Z, 0–9). The code can't be changed or regenerated, and a deleted team's code is never given to another team.
- A team's name can be changed, and its logo set, replaced or removed, by its Admins and by system administrators (confirmed; the system-administrator part comes with system administration, roadmap step 9). Uploading a new logo replaces the old one and removing a logo happens at once, both without asking (confirmed). After "Create team" the new team's page opens (confirmed).
- Within a team, members have one of the roles Admin, Editor, or Reader (see ch. 8 for the permission matrix). All members, Readers included, see the member list (display names and roles).
- Finding a team (logged in only): through a link (`/teams/<CODE>`), or through an overview page listing all teams (name + logo), searchable by a part of the name or of the code (ignoring upper/lower case), a page at a time. **Non-members see only a team's name and logo** — never its code or link, neither on its page nor in the overview (confirmed; a team found by its code shows just name and logo). Members also see the code, the link to share and their role.
- Joining a team, also through a link: a logged-in non-member sends a join request from the team's page; a team Admin accepts or rejects it. There is at most one pending request per user and team; it can't be withdrawn; after a rejection the user may request again. While it is pending, the team's page says so. Accepted members start as Reader. The team's Admins see the pending requests (with their number) on the team's page and on the start page.
- Team Admins manage members and their roles: they can remove members and change any member's role, other Admins' and their own included, as long as the team keeps at least one Admin — also when several changes happen at the same time. Removing a member asks for confirmation.
- Members can leave a team (after a confirmation). The last Admin of a team cannot leave it; they are told to make another member Admin first or to delete the team. Deleting a team (Admins) asks for confirmation and deletes its memberships, pending join requests, folders and situations with it. A member who leaves or is removed, and a user whose request is rejected, has no access to the team from their next request on (the team's page then shows what non-members see).

**Non-functional requirements**

- Usability in the browser, on both mobile and desktop.
- Performance.

## 1.2 Quality Goals

1. Usability across devices (mobile and desktop browsers).
2. Performance.

_Not yet ranked beyond this order — revisit if the two ever trade off against each other._

## 1.3 Stakeholders

| Role | Person | Concern |
|---|---|---|
| Product owner, developer, and primary user | Sven | Only stakeholder; builds and uses the app himself. |
