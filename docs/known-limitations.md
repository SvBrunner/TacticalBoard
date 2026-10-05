# Known limitations

## No server-rendered pages

The board editor (`frontend/src/routes/editor/+page.svelte`) draws its content with Konva canvases. Konva requires a browser (canvas/DOM APIs) and cannot run in a server-side rendering context, so `frontend/src/routes/editor/+page.ts` sets `ssr = false` for the editor route.

Since the switch to `adapter-static` (ADR-008), the whole app is a static single-page app: `frontend/src/routes/+layout.ts` sets `ssr = false` for every route, nothing is prerendered, and the web server answers every path with the fallback page `index.html`. The start page is therefore rendered in the browser too.

**Impact:**
- No server-rendered HTML for any page — search engines and no-JS clients see an empty shell.
- First paint waits for JS to load and run.

## No pinch-zoom on the board

The field is always scaled to fit the available space and cannot be zoomed or panned. The board area disables the browser's own touch gestures (`touch-action: none`), so a pinch neither zooms the page nor the board. This is a deliberate MVP decision.

**Impact:**
- On a phone in portrait orientation the full field is never rotated, so it is drawn small (about the screen width × half of it), and so are the elements, since they keep their proportions to the field. (Half-field situations are shown in portrait and use the space better.)
- Elements get an enlarged invisible hit area of at least 44 CSS px, so they stay easy to tap and drag. Where hit areas of close elements overlap, the topmost element wins, and a tap near an element selects it instead of placing a new one.
- Users who need more detail can turn the phone to landscape or use a tablet/desktop.

## Situations that are not saved on the server live in memory only

A new or imported situation that isn't saved on the server (always in local mode) exists only in the browser tab's memory. Reloading the page or opening `/editor` directly therefore has no situation to show and leads back to the start page. While there are unsaved changes, the browser warns before the page is left or reloaded. A saved situation is restored after a reload from `/editor?situation=<id>` (its unsaved changes are lost, after the browser's warning).

## Saving on the server

- **Personal area only.** Teams exist, but saving situations in a team comes with roadmap Phase 2 step 8.
- **The lists are not live.** The start page's folders (with their situation counts) and situations and a folder's page are loaded when the page is shown (and after a delete, move or new folder); changes made in another tab or by another session appear after navigating to the page again. A folder deleted or renamed elsewhere still shows its old state until then (an action on it then says that it no longer exists).
- **Deleting is only possible from the lists** (the start page or a folder's page), not in the editor. Deleting the situation that is still open in the editor (e.g. after the browser's Back button) is not noticed there; its next save fails with "This situation no longer exists on the server" and it can only be exported.
- **Every save is a full revision.** Even a save without changes writes a new revision; nothing is pruned (see arc42 ch. 11).
- **Titles are limited to 200 characters** on the server (the editor doesn't limit typing; saving a longer title is rejected with a message). A numbered title (" (2)") may be slightly longer.
- **Numbered titles are numbered on, never back**: a copy of "Powerplay (5)" becomes "Powerplay (6)" even if "Powerplay (2)" is free. Only a suffix " (n)" with a space before it counts; "Powerplay(2)" or "Powerplay (x)" get " (2)" appended.
- **A situation with nothing to save can't be saved**: the Save button is disabled and Ctrl/Cmd+S does nothing while a saved situation has no changes, so a revision without changes is no longer written by accident (a never-saved situation can always be saved).
- **Unknown extra properties** of a document are stored as sent (the validator ignores them, like the importer).
- **Edits made while a save is running** stay unsaved (the situation stays dirty); the server's title wins only if the title wasn't changed in the meantime.
- **The conflict question doesn't show what the other person changed**; there is no comparison or merge.
- **Created/changed by** names are looked up when listing; a renamed user shows the new name for older changes too.

## Folders

- **Flat, personal area only.** No subfolders (by design, arc42 ch. 1); team folders come with teams.
- **Moving works with the Move button and a picker**, not by drag and drop. It moves one situation at a time, only within the area (copying to another area works only through export and import).
- **Renaming and deleting a folder happen on its page**, not in the start page's list. A folder's page lists only its situations; the start page lists only the top level, so there is no view of all situations at once and no search.
- **The editor doesn't show the folder's name** of the edited situation; only the badge ("Back to the folder") tells that it lies in a folder. Its **New** and **Load** save into that folder (the folder of the last known state: a move made in another tab is noticed only after reopening the situation). If that folder was deleted meanwhile, the first save fails with "The folder to save in no longer exists" and the situation can only be exported. In local mode they always start at the top level, and the badge leads to the start page.
- **A move doesn't count as a change**: "Last changed by/at" and the lists' order stay as they were (the revision and the ETag stay too, arc42 ch. 8.15).
- **Folder names**: at most 64 characters, no line breaks or other control characters; a taken name is refused (no automatic numbering, unlike titles). Renaming has no conflict check; the last rename wins.
- **Folders are sorted by name** with a culture-independent, case-insensitive comparison (e.g. accented letters sort with their base letter, but language-specific orders are not followed).
- **A folder that still contains situations can't be deleted** (by design); its situations have to be moved or deleted one by one first.
- **The situation count** is shown only in the start page's folder list (not on the folder's page header or in the move dialog), and it counts situations only, as of loading the list.

## Teams

- **No notifications.** A join request, its acceptance or rejection, a role change or a removal is not announced anywhere else: the requester sees the outcome only on the team's page (a rejected request just isn't pending any more — "Ask to join" is offered again, without saying that it was rejected), and Admins see waiting requests only on the team's page and as a count on the start page. Nothing is sent by e-mail.
- **No history in the UI.** Decided join requests are kept in the database but not shown anywhere; there is no list of past members and no "who changed which role".
- **Changing a role takes effect at once**, without a confirmation — also when Admins demote themselves (they then lose the Admin sections right away; another Admin has to promote them again). Removing a member, leaving and deleting the team ask first.
- **Deleting a team can't be undone in the app** (soft delete in the database, no restore UI). Its folders and situations will be deleted with it once teams have them (roadmap step 8).
- **The member list is not live**: changes by other Admins appear after reloading the team's page; an action on a member who changed meanwhile reloads the list and says why it failed.
- **Members are sorted by display name** with a culture-independent, case-insensitive comparison; display names are not unique, so two members can look the same.
- **A non-member doesn't get the team's code or link** (by design); they can only open the team through a link someone shares, by its id (from the overview), or after joining. A non-member who opened the team's link knows the code from the address bar anyway.
- **Team names**: at most 64 characters, no line breaks or other control characters; a taken name is refused. Renaming has no conflict check; the last rename wins. A team's code never changes, and the code of a deleted team is never given to another team.
- **The overview is searched by substring** of the name or the code, ignoring case (e.g. "ions" finds "Lions"); there is no fuzzy matching, no ranking, and no search for accents ("Zurich" doesn't find "Zürich"). It loads 50 teams at a time ("Show more"); the order is the database's order of the upper-cased names, which may differ slightly from a language's alphabetical order. The search scans all team names (no index for substrings); fine for thousands of teams.
- **The lists are not live**: the start page's teams (with the count of waiting join requests) and the overview are loaded when the page is shown.
- **Logo uploads**: PNG, JPEG or WebP of at most 5 MB and 25 megapixels; no SVG or GIF, no cropping. The logo is stored as a PNG fitting 256 × 256 px (never scaled up, the aspect ratio kept), so a photo's logo can be larger in bytes than the original JPEG of the same size; an animated image keeps its first frame. Metadata (EXIF, comments, color profiles) is dropped; colors are converted to sRGB. A request larger than about 5 MB is cut off by the server (the app checks the size before uploading).
- **A logo is shown to every logged-in user** (it is part of the team's public data), and it is revalidated with the server on every display (cheap, but a request per logo). Removing a logo happens at once, without asking (by design).
- **System administrators can't manage teams yet** (renaming, logos, members, deleting): that comes with system administration (roadmap step 9).

## Hidden-half elements of half-field situations

A half-field situation shows only one half of the field (see [ch. 8](arc42/08_crosscutting_concepts.md)). Elements from an imported file that lie in the other half stay in the data but are not visible and cannot be reached. An element right at the center line can be partly visible; its enlarged hit area can reach into the visible half.

## Little room for the field on landscape phones with the details panel open

On phones the details panel (title, descriptions) is a collapsible bar above the board. Opened on a phone in landscape orientation, it takes up to about half of the already small height, so the field becomes very small until the panel is collapsed again. Portrait phones and larger screens are much less affected.

## Editing arrows on small screens

On phones the edit popover is a bottom sheet. On a landscape phone (and partly on a portrait phone) it covers the board, including the handles of the selected arrow. The arrow popover therefore has an **Edit shape** button that hides the popover but keeps the arrow selected, so its handles can be dragged; tapping a bend brings the popover back (for "Remove bend").

On a small board (e.g. a half field on a landscape phone, about 220 CSS px) the 44 CSS px hit circles of an arrow's handles overlap on short segments. Where they do, the start, end and bend handles win over the "+" (add bend) handles, so a bend can then only be added on a longer segment, or after turning the phone or using a larger screen.

## GIF export: sharing and performance

**Share** in the GIF export dialog appears only where the browser can share files (`navigator.canShare({ files })`): typically Safari and Chrome on phones and tablets, some desktop browsers (e.g. Safari on macOS, Chrome on Windows) too, but not Firefox on the desktop. Elsewhere only **Download** is offered. The decision is pure feature detection, not "is this a phone".

The GIF is rendered and encoded in the browser's main thread, one frame at a time. Between frames the page stays responsive (progress, Cancel), but a single frame blocks it briefly — longer at the Large resolution and on slow phones. Memory grows with frames × resolution (each Large frame is 1800 px wide). Situations with many frames at Large therefore take noticeably longer and produce large files; nothing caps the frame count.

GIF stores frame delays in hundredths of a second and at most 256 colors per frame; antialiased edges are slightly quantized.


## Login and session

- **The session does not follow the IdP session.** After the login the session lives on its own (14 days without use, sliding) and is checked against the local user on every request (blocked, deleted). Logging out at the IdP directly, or the IdP ending its session, does not end it: IdP-initiated (front-channel/back-channel) logout is not supported, and the IdP's tokens are not refreshed or re-validated. A user blocked or disabled only at the IdP keeps an existing session until it expires or they log out; blocking in the app ends it at once.
- **Logging out at the IdP depends on the IdP.** If the IdP's discovery document has no `end_session_endpoint` (or the IdP can't be reached), "Log out" ends only the app's session; the next "Log in" may then return without asking for credentials.
- **A failed login says only "Login failed."**, except for a blocked account ("Account blocked."). The start page does not tell other reasons (IdP error, unusable identity), on purpose; the reason is in the backend log.
- **A deleted account comes back empty.** Logging in again with the identity of a deleted account creates a new, empty account; nothing of the old one (situations, memberships) is restored, and there is no restore UI.
- **Data-protection keys are stored unencrypted** in `DataProtection__KeysDirectory` (the backend logs a warning at startup). Whoever can read that volume can decrypt session cookies; protect it like the database.
- **One database query per request with a session**, for the per-request check of the user. Cheap (primary key, no tracking) and the price of "a blocked user's session ends with the next request".
- **The dev server logs a proxy error** (`http proxy error: /api/me`) in its terminal when `pnpm run dev` runs without a backend. The app itself stays quiet ("Local mode").

## Localization

- **Two languages**, German and English; everything else falls back to English. A new language is a new file in `frontend/src/lib/i18n/locales/` (no backend change), but all catalogs are bundled and loaded at once.
- **Stored texts don't follow the language.** User content is never translated, and that includes a default title once it is stored: a situation created in German keeps "Unbenannte Situation" when the UI is switched to English. A situation saved with a blank title by another client gets the server's English default "Untitled Situation".
- **Some technical details stay English**: the reason of a failed GIF export or share (it comes from the browser or the encoder), the field paths in server validation messages (e.g. `document.situation.title`), the debug notification log (dev builds only), and the server's own `title`/`detail` (only for logs and API consumers; the UI words the error codes).
- **The account's language is applied once per login.** Choosing another language in a second tab or browser of the same session doesn't switch the first one; it gets the account's language at its next login. An account that never chose a language keeps each browser's own language.
- **Dates follow the UI language**, not the browser's region: German shows "04.10.2026, 10:30" also on a Swiss or Austrian browser; English uses the US-style "Oct 4, 2026, 10:30 AM".
- **Position codes stay as they are** (G, V, C, F, LV, …, derived from German terms); only their full names are translated.

## Deployment

- **One backend instance only.** Migrations run at startup and the data-protection keys are a file-system directory, so several backend replicas would race on migrations and need a shared key directory. Scaling out is not supported yet.
- **No Helm chart yet** — only the Docker Compose example (`deploy/production/`, [deployment.md](deployment.md)); a chart is planned (roadmap "Later").
- **No sub-path hosting.** The app must own the whole origin (`https://tacticalboard.example.org/`), not a path below another site.
- **Data-protection keys are not encrypted at rest** — they lie unencrypted on the key volume (protect it like the database). ASP.NET Core's key-encryption options are not wired in.
- **The backend trusts forwarded headers from any sender** (`ASPNETCORE_FORWARDEDHEADERS_ENABLED`, no list of known proxies), so its port must be reachable only through the gateway/reverse proxy.
- **`latest` is the newest `master` build**, not the newest release. Production should pin a version tag.
- **Images for `linux/amd64` and `linux/arm64` only.**
