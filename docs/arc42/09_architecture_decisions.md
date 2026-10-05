# 9. Architecture Decisions

Significant decisions, recorded as lightweight ADRs.

## ADR-001: Backend technology is .NET

- **Status**: Accepted
- **Context**: Needed a backend technology for the REST API and business logic.
- **Decision**: Use .NET.
- **Rationale**: Developer's existing experience and preference — no deeper technical driver.
- **Consequences**: Backend tooling, hosting, and CI need a .NET runtime/container base image.

## ADR-002: PostgreSQL as default database, behind a swappable data-access layer

- **Status**: Accepted
- **Context**: Needed a self-hostable database (ch. 2) as the default persistence choice.
- **Decision**: Use PostgreSQL, accessed only through a data-access abstraction inside the backend.
- **Rationale**: PostgreSQL is a solid, self-hostable default; isolating data access keeps the door open to swapping it later without a design that hard-codes Postgres-specific assumptions elsewhere.
- **Consequences**: No feature may depend on Postgres-specific behavior outside the data-access layer.

## ADR-003: Authentication delegated to a self-hosted OIDC Identity Provider

- **Status**: Accepted
- **Context**: Need login/authentication that stays self-hostable (ch. 2), without building and maintaining custom auth.
- **Decision**: Delegate authentication to an external OpenID Connect Identity Provider. The system is **not tied to a product**: it works with any standard OIDC provider (e.g. PocketID, Keycloak, Authentik), self-hosted or not. Every valid login from the configured provider becomes a normal user; who may register is configured in the IdP.
- **Consequences**: Deployment must point to an IdP instance (the local Compose setup brings a development IdP). The backend needs no password storage of its own. Users are identified by issuer + subject, never by e-mail.

## ADR-004: Containerized, self-hosted deployment; no SaaS vendor lock-in

- **Status**: Accepted
- **Context**: The app must be runnable by someone other than the original developer, on their own infrastructure.
- **Decision**: Ship as OCI containers; avoid dependencies on proprietary managed cloud services for auth, database, or storage.
- **Consequences**: Every required external dependency (DB, IdP) must itself be self-hostable.

## ADR-005: Docker Compose now, Helm later

- **Status**: Accepted
- **Context**: The stack (frontend, backend, PostgreSQL, IdP) has to be started locally and self-hosted.
- **Decision**: Docker Compose for local development and simple deployments. A Helm chart for Kubernetes comes later.
- **Consequences**: Configuration only through environment variables and volumes, so the same images run under Compose and Kubernetes.

## ADR-006: Login as backend for frontend (BFF), session cookie

- **Status**: Accepted
- **Context**: A browser app needs to call the API as the logged-in user. Options: tokens in the browser (public client, JWT bearer), or the backend as OIDC client with a cookie session (BFF).
- **Decision**: BFF. The backend runs the Authorization Code flow with PKCE, keeps the tokens, and gives the browser an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. State-changing requests additionally need an antiforgery header.
- **Rationale**: Tokens are out of reach of injected JavaScript (XSS); refresh and logout are handled server-side; this is what the current OAuth guidance for browser-based apps recommends. Frontend and API share one origin anyway (ch. 7).
- **Consequences**: CSRF protection is required (ch. 8.13). Other clients (e.g. native apps) can later be supported by also accepting JWT bearer tokens; both schemes can coexist. The frontend knows only `/auth/login`, `/auth/logout` and `/api/me`, so the backend remains replaceable.

## ADR-007: Modular monolith, dependency injection, swappable infrastructure

- **Status**: Accepted
- **Context**: Solo project; the backend should be easy to run, but its parts (database, identity) replaceable.
- **Decision**: One deployable backend, split into modules by domain (ch. 5.2). Domain and application code depend only on interfaces (repositories, clock, ID/code generators, current user); implementations are registered through ASP.NET Core dependency injection. EF Core with Npgsql is the only implementation of the repositories.
- **Consequences**: Domain logic is unit-testable without a database. A module may use another only through its public interfaces.

## ADR-008: Static frontend build

- **Status**: Accepted
- **Context**: The editor already runs client-side only (Konva, ch. 8); the backend owns all server logic.
- **Decision**: Build the frontend with `adapter-static` (SPA fallback) and serve it from a small web server container.
- **Consequences**: No Node server in production. The start page loses server rendering, which brings no benefit behind a login anyway.

## ADR-009: Situations stored as JSON document plus metadata, with revisions

- **Status**: Accepted
- **Context**: Situations already have a versioned JSON file format (ch. 8.3). The server needs to list, sort and search them, and versioned storage may come later.
- **Decision**: Every save stores the complete situation document (always in the current format version) as a new **revision** row (`jsonb`). The situation row holds the metadata as ordinary columns: area, folder, title, field type, sport, format version, created/updated at and by, the current revision number, deleted at. Only the current revision is used in Phase 2; there is no UI for older revisions.
- **Rationale**: One format for files and server, no mapping of frames and elements to tables; the revision table makes later version history and realtime editing possible without a data migration.
- **Consequences**: The frontend migrates older file versions before uploading; the backend validates the current format only, with a port of the frontend's validator that has to be kept in sync (ch. 8.15). The revision number is the concurrency token (ETag). The server owns the situation's id, title and timestamps and writes them into every stored document, so a revision never disagrees with its row. Storage grows with every save (acceptable at this scale; pruning can come later).

## ADR-010: Realtime after Phase 2, without blocking it

- **Status**: Accepted
- **Context**: Collaborative editing over WebSockets is wanted, but not in Phase 2.
- **Decision**: Phase 2 is REST only. It must not block realtime later: stable element IDs, edits as commands (already in the frontend), domain services independent of the transport, revision numbers on situations, and a session cookie that also works for a WebSocket connection on the same origin.
- **Consequences**: No transport-specific logic in the domain modules.

## ADR-011: Backend testing

- **Status**: Accepted
- **Decision**: Unit tests have priority (xUnit, domain and application services against fakes of the interfaces). Integration tests with Testcontainers (real PostgreSQL) cover repositories, migrations and the HTTP API in addition.
- **Consequences**: The Nix flake provides the .NET SDK; integration tests need a container runtime.

## ADR-012: Rules across modules held by one database transaction with row locks

- **Status**: Accepted (roadmap Phase 2 step 4)
- **Context**: "A folder can only be deleted while it contains no situations" spans two modules: Folders owns the folder, Situations the situations, and Folders may not use Situations (ch. 5.2). Checking first and deleting afterwards leaves a gap: a parallel move into the folder (or a first save in it) could land in between, and the situation would end up in a deleted folder, invisible everywhere. A database foreign key doesn't help (soft delete, and the tables belong to different modules).
- **Decision**: Folders declares the question as a contract (`IFolderContents`), Situations implements it. The deletion, the move into a folder and the first save in a folder each run in **one database transaction** through `IUnitOfWork` (SharedKernel; `EfUnitOfWork` on the single shared EF Core context). The deletion locks the folder row exclusively (`FOR UPDATE`) before checking for situations; placing a situation locks it shared (`FOR SHARE`) and requires it to be not deleted. Whichever comes first wins; the other waits and then sees the result (ch. 6.4). The locks are raw SQL inside the Folders repository (PostgreSQL syntax kept in the data-access layer, ADR-002). Moving a situation writes only its folder column, without the revision check, so it never conflicts with saving the content (ch. 8.15).
- **Rationale**: Correct under parallel requests with the default isolation level, no extra columns or cross-module writes, short locks on one row. Optimistic alternatives (a version column on the folder that every placement must bump) would make Situations write Folders' table.
- **Consequences**: Application code that must be atomic across modules uses `IUnitOfWork`; nested use joins the running transaction, and EF Core's automatic savepoints keep the numbered-title retry working inside it. A placement and a deletion of the same folder serialize briefly. Swapping the database means re-implementing the two lock queries. Integration tests hold a lock in one transaction and check that the other request waits and ends correctly. The same pattern guards the rules on a team's members (roadmap step 7): every change of a team's members, join requests or existence locks the team row (`FOR UPDATE`) first, so "at least one Admin" holds against parallel demotions, removals and leaves (ch. 6.7, 8.17).

## ADR-013: Own typed i18n service instead of an i18n library

- **Status**: Accepted (roadmap Phase 2 step 5)
- **Context**: The UI needs German and English (ch. 8.18), more languages only by adding a translation file, no untranslated or misspelled keys, simple tests that run in a fixed language, a small bundle, and texts produced in classes (error messages, questions) that follow a language switch. Options: Paraglide (compiled messages, typed, tree-shaken), svelte-i18n (ICU messages, runtime, string keys), or a small own service.
- **Decision**: A small class-based service of our own (`frontend/src/lib/i18n/`): one TypeScript catalog per language, the English catalog defines the type `Messages` every other catalog must match; parameterized texts are plain functions; `I18n` holds the language as Svelte stores; classes return `Translatable` (a function of the catalog) instead of strings; the bundled catalogs are discovered with `import.meta.glob`.
- **Rationale**: Full type safety through the compiler with no code generator or build step (Paraglide needs its own compiler and project files; svelte-i18n has untyped string keys and ships an ICU runtime). Two languages and a few hundred texts don't need plural or ICU machinery — a function per text handles word order and inflection. Tests stay plain (catalogs are ordinary modules; `i18n.reset()` per test). Bundle cost is the catalogs themselves (a few kB each).
- **Consequences**: All catalogs are loaded eagerly (fine for two languages; lazy loading per language can come later via `import.meta.glob` without `eager`). Pluralization rules, if ever needed, are written per text. The backend stays language-agnostic: it sends stable codes (ch. 8.2) and stores the account's language tag without knowing which languages exist.

## ADR-014: SkiaSharp for team logos

- **Status**: Accepted (roadmap Phase 2 step 6)
- **Context**: Team logos are uploaded as PNG, JPEG or WebP; the backend must detect the format from the content, reject everything else (notably SVG), apply the EXIF orientation, scale down to fit 256 × 256 px and re-encode without metadata (ch. 8.17). .NET has no built-in cross-platform image codec (`System.Drawing` is Windows-only). The project is meant to be open source under MIT. Candidates: **ImageSharp** (pure managed, convenient API, but under the *Six Labors Split License*: free only for open-source or small commercial use below a revenue threshold, otherwise a paid commercial license — an extra condition for everyone who self-hosts), **Magick.NET** (Apache-2.0, ImageMagick; large native dependency with a big attack surface and many formats to disable), **SkiaSharp** (MIT; Google's Skia, BSD-3, with libpng, libjpeg-turbo and libwebp).
- **Decision**: SkiaSharp (`SkiaSharp` + `SkiaSharp.NativeAssets.Linux.NoDependencies`, 4.x), used only inside the Teams module's infrastructure (`SkiaLogoImageProcessor` behind the application interface `ILogoImageProcessor`).
- **Rationale**: Clearly permissive licenses compatible with MIT, no revenue conditions for self-hosters. Decodes exactly the needed formats, supports scaled decoding (JPEG, WebP) to keep memory low, reports the EXIF orientation, and encodes PNG. The `NoDependencies` native package needs nothing beyond glibc, so the `aspnet` runtime image needs no extra packages (also works on NixOS for development).
- **Consequences**: A native library (per platform) in the backend; the published output carries native assets for several platforms. Untrusted images are parsed by native code — mitigated by the byte and megapixel limits checked before decoding and by keeping SkiaSharp up to date (ch. 11). Swapping the library touches one class; the domain only knows `TeamLogoImage`.

## ADR-015: Deleting a team's content through a chain of module contracts

- **Status**: Accepted (roadmap Phase 2 step 7; the content side is implemented in step 8)
- **Context**: Deleting a team must soft-delete its folders and situations in the same transaction (ch. 1, 8.16). The module dependencies (ch. 5.2) point Situations → Folders → Areas → Teams, so Teams can't call Folders or Situations, and Folders and Situations can't see Teams' contracts (transitive references are switched off). Alternatives: Teams references Folders/Situations (breaks the arrows, cycles); an in-process event bus (more infrastructure, harder to keep in one transaction); a database cascade (crosses module boundaries in SQL, no soft delete).
- **Decision**: Two small in-process contracts, each declared by the module that is used and implemented by the module that uses it (dependency inversion, like `IFolderContents` and the planned account deletion): Teams declares `ITeamDeletionParticipant` (+ `TeamDeletion`: team id, timestamp, by whom) and calls every registered implementation inside its locked deletion transaction; Areas implements it (`TeamAreaDeletion`) and passes it on, as "this area goes away", to every `IAreaContentDeletion` (declared by Areas, implemented by Folders and Situations in step 8). A participant that throws rolls the whole deletion back.
- **Rationale**: Keeps the dependency arrows and the compile-time module checks; one transaction on the shared context (ADR-012), no extra infrastructure; the area-level contract can serve account deletion (a personal area going away, step 10) too.
- **Consequences**: Until step 8 no `IAreaContentDeletion` is registered, so deleting a team deletes no content (teams have none yet). Every module that keeps data in areas must register an implementation, or a deleted team's data stays behind — step 8's tests have to cover that. The order of the participants is not defined; each must soft-delete independently of the others.

