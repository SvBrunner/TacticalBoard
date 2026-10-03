# 8. Cross-cutting Concepts

## 8.1 Authorization Concept

There are two levels of roles:

- **System-wide:** *system administrator* or *normal user*. System administrators only handle operations/technical settings and have no special access to teams or their content. Any user can create a team.
- **Per team:** **Admin**, **Editor**, **Reader**. These apply across the Teams, Folders, and Boards modules (chapter 5). The creator of a team becomes its Admin. Members whose join request is accepted start as Reader.

**Team permission matrix (confirmed):**

| Action | Admin | Editor | Reader |
|---|---|---|---|
| View team's boards/folders | ✅ | ✅ | ✅ |
| Create/edit/delete a board | ✅ | ✅ | ❌ |
| Create/rename/delete a folder | ✅ | ✅ | ❌ |
| Accept/reject join requests | ✅ | ❌ | ❌ |
| Manage team members/roles | ✅ | ❌ | ❌ |
| Leave the team | ✅¹ | ✅ | ✅ |
| Delete the team | ✅ | ❌ | ❌ |

¹ Except the team's last Admin, who has to delete the team instead.

Enforcement point: the backend (chapter 5's Teams module owns the role check; Boards/Folders modules call into it rather than duplicating authorization logic).

## 8.2 API Error Handling

Proposed: consistent error responses using [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807) (`application/problem+json`), which ASP.NET Core supports natively. Not yet confirmed.

Example shape:

```json
{
  "type": "https://tacticalboard/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Role 'Reader' cannot edit boards in this team."
}
```
