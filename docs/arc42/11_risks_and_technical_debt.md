# 11. Risks and Technical Debt

See also [known-limitations.md](../known-limitations.md).

## Current risks

| Risk | Description | Related |
|---|---|---|
| Backend is incomplete | The backend runs (modules, database, migrations, health endpoint, login with users, saving situations and folders in the personal area, creating teams with overview, team page and logo), but team membership management, team situations and folders, and system administration are specified and not implemented yet. | ch. 5, 9, [roadmap](../roadmap.md) |
| Two validators of the situation format | The frontend (`SituationFileValidator`) and the backend (`SituationDocumentValidator`) check the same format; a format change must update both. Mitigated: the backend's tests port the frontend's cases and validate the frontend's fixture files. | ch. 8.3, 8.15 |
| Database-specific row locks | Two queries in the Folders repository use PostgreSQL row locks (`FOR UPDATE` / `FOR SHARE`) to keep "delete a folder only when empty" correct under parallel requests (ADR-012). Contained in the data-access layer; another database needs its own version. Covered by integration tests. | ADR-002, ADR-012 |
| Database-specific row locks for teams | Every change of a team's members, join requests or existence locks the team row with PostgreSQL's `SELECT … FOR UPDATE` inside the Teams repository (ch. 8.17), like folders (ADR-012). Changes of one team run one after another — fine for team sizes, a bottleneck only if one team got many parallel changes. Another database needs its own lock statement. | ADR-002, ADR-012, ch. 8.17 |
| Database-specific upsert | The team logo is written with PostgreSQL's `INSERT … ON CONFLICT DO UPDATE` inside the Teams repository (ch. 8.17). Contained in the data-access layer; another database needs its own version. | ADR-002, ch. 8.17 |
| Native image library | Team logos are decoded with SkiaSharp's native library (ADR-014): a parser of untrusted images in the backend process. Mitigated: size and megapixel limits checked before decoding, only PNG/JPEG/WebP; keep SkiaSharp updated for security fixes. | ADR-014, ch. 8.17 |
| CI actions pinned to major tags | The workflows use third-party actions by major version tag (ADR-016); a compromised tag would run with `packages: write` when images are published. Mitigated: only actions from GitHub, Docker and pnpm, minimal permissions per job, no secrets besides `GITHUB_TOKEN`. Switch to SHA pins if the project grows. | ADR-016, ch. 7 |
| Bus factor of one | Solo project; no redundancy in project knowledge. | ch. 1, 2 |
| Unbounded growth of soft-deleted data and revisions | Nothing is purged yet (ch. 8.16, ADR-009). Fine at the expected scale; a purge/retention concept is needed before it matters. | ch. 8, 9 |

## Technical debt

- No page is server-rendered (see [known-limitations.md](../known-limitations.md)) — accepted: Konva needs a browser, and the static build (ADR-008) renders every route client-side.
- No pinch-zoom on the board (see [known-limitations.md](../known-limitations.md)) — accepted for the MVP. On small phones in portrait the field, and with it every element, is drawn small; enlarged touch hit areas keep elements tappable, but precise placement is harder than on larger screens.
