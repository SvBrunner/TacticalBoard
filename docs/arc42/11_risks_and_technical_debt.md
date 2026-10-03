# 11. Risks and Technical Debt

See also [known-limitations.md](../known-limitations.md).

## Current risks

| Risk | Description | Related |
|---|---|---|
| No backend exists yet | Teams, folders, server-side board storage, and auth are all specified but unimplemented. Only local (client-side) board JSON export/import currently works. | ch. 5, 9 |
| Bus factor of one | Solo project; no redundancy in project knowledge. | ch. 1, 2 |
| Open technology choices | IdP product (PocketID vs. Keycloak vs. other), container orchestration (Compose vs. Kubernetes), and error-response format are not yet finalized. | ch. 7, 8, 9 |

## Technical debt

- The board page cannot be server-rendered (see [known-limitations.md](../known-limitations.md)) — accepted trade-off for now given Konva's browser-only requirement.
