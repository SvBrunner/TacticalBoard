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

## 8.3 Situation File Format

Situations are exported and imported as JSON files named `<slug-of-title>.situation.json` (`situation.json` if the title yields no usable characters), pretty-printed with a 2-space indent.

**Format version 1:**

```json
{
  "format": "tacticalboard.situation",
  "formatVersion": 1,
  "situation": {
    "id": "…",
    "title": "Powerplay vs. 2-3-1",
    "description": "Markdown source",
    "sport": "floorball",
    "fieldType": "full",
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-02T12:30:00.000Z",
    "frames": [
      {
        "id": "…",
        "description": "Markdown source",
        "elements": [
          { "id": "…", "type": "Player", "color": "oklch(62% 0.16 230)", "x": 1200, "y": 300 }
        ]
      }
    ]
  }
}
```

- `format` identifies the file as a TacticalBoard situation; `formatVersion` is a positive integer.
- `sport`: currently only `floorball`. `fieldType`: `full` or `half`; fixed when the situation is created.
- `title` may be empty (the UI then shows "Untitled Situation"). Descriptions are Markdown source.
- `createdAt`/`updatedAt` are ISO 8601 timestamps.
- There is at least one frame. Frame IDs are unique within the situation; element IDs are unique within a frame, and the same element ID in different frames denotes the same element.
- Element `type`: `Player`, `Ball`, `Rectangle`, `Triangle`, `Circle`. There are no rules on how many of each a frame may contain.
- **Coordinates** (`x`, `y`) are always in full-field scene units of the sport (floorball: 2000 × 1000, origin top-left), also for half-field situations.
- Unknown extra properties are ignored on import.

**Versioning and migration policy:** every change to the file format bumps `formatVersion` and comes with a migration from the previous version, so files exported by older app versions keep importing. Import runs parse → migrate (chained, one version step at a time) → validate → map to the domain model. Files with a newer version than the app supports are rejected with a request to update the app. The validator reports all problems at once, with paths such as `situation.frames[0].elements[2].x: expected finite number`.

**Legacy format:** the pre-v1 export (a top-level JSON array of elements) is not supported and is rejected with "This file uses an old format that is no longer supported".

**Import creates a new situation:** the imported situation gets a fresh situation ID; frame and element IDs are kept. It replaces the content of the editor.

Implementation: `frontend/src/lib/model/serialization/` (`SituationSerializer` facade, `SituationFileMigrator`, `SituationFileValidator`, `SituationMapper`).
