# 8. Cross-cutting Concepts

## 8.1 Authorization Concept

Roles are scoped per team (chapter 1): **Admin**, **Bearbeiter** (editor), **Leser** (reader). They apply across the Teams, Folders, and Boards modules (chapter 5).

**Proposed permission matrix — not yet confirmed, draft only:**

| Action | Admin | Bearbeiter | Leser |
|---|---|---|---|
| View team's boards/folders | ✅ | ✅ | ✅ |
| Create/edit/delete a board | ✅ | ✅ | ❌ |
| Create/rename/delete a folder | ✅ | ✅ | ❌ |
| Manage team members/roles | ✅ | ❌ | ❌ |
| Leave the team | ✅ | ✅ | ✅ |
| Delete the team | ✅ | ❌ | ❌ |

Enforcement point: the backend (chapter 5's Teams module owns the role check; Boards/Folders modules call into it rather than duplicating authorization logic).

## 8.2 API Error Handling

Proposed: consistent error responses using [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807) (`application/problem+json`), which ASP.NET Core supports natively. Not yet confirmed.

Example shape:

```json
{
  "type": "https://tacticalboard/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Role 'Leser' cannot edit boards in this team."
}
```
