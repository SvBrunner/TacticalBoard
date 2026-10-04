# 11. Risks and Technical Debt

See also [known-limitations.md](../known-limitations.md).

## Current risks

| Risk | Description | Related |
|---|---|---|
| Backend is only a skeleton | The backend runs (modules, database, migrations, health endpoint), but login, teams, folders and server-side board storage are specified and not implemented yet. Only local (client-side) board JSON export/import currently works. | ch. 5, 9, [roadmap](../roadmap.md) |
| Bus factor of one | Solo project; no redundancy in project knowledge. | ch. 1, 2 |
| Unbounded growth of soft-deleted data and revisions | Nothing is purged yet (ch. 8.16, ADR-009). Fine at the expected scale; a purge/retention concept is needed before it matters. | ch. 8, 9 |

## Technical debt

- No page is server-rendered (see [known-limitations.md](../known-limitations.md)) — accepted: Konva needs a browser, and the static build (ADR-008) renders every route client-side.
- No pinch-zoom on the board (see [known-limitations.md](../known-limitations.md)) — accepted for the MVP. On small phones in portrait the field, and with it every element, is drawn small; enlarged touch hit areas keep elements tappable, but precise placement is harder than on larger screens.
