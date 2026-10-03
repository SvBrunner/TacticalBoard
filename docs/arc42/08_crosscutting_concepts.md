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

**Format version 2** (current):

```json
{
  "format": "tacticalboard.situation",
  "formatVersion": 2,
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
          { "id": "…", "type": "Player", "color": "oklch(62% 0.16 230)", "x": 1200, "y": 300, "label": "C" }
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
- **Coordinates** (`x`, `y`) are always in full-field scene units of the sport (floorball: 2000 × 1000, origin top-left), also for half-field situations. A half-field situation uses the right half, `x ∈ [1000, 2000]` (see 8.6).
- Element `label`: the **position label**, `""` (no label) or 1–2 characters, each a letter or a digit (e.g. `C`, `LV`, `10`). Stored per element **per frame**, like the color; duplicates within a frame are allowed. Every element type carries it, but only players show it: changing a player to another type hides the label, changing it back shows it again. The UI upper-cases typed letters; the importer also accepts lower case and keeps it as is.
- Unknown extra properties are ignored on import.

**Format history:**

| Version | Change | Migration from the previous version |
|---|---|---|
| 1 | Initial situation format | – |
| 2 | Elements get `label` | `MigrationV1ToV2`: every element gets `"label": ""` (a `label` property in a v1 file was an ignored extra property and is replaced) |

**Versioning and migration policy:** every change to the file format bumps `formatVersion` and comes with a migration from the previous version, so files exported by older app versions keep importing. Import runs parse → migrate (chained, one version step at a time) → validate → map to the domain model. Files with a newer version than the app supports are rejected with a request to update the app. The validator reports all problems at once, with paths such as `situation.frames[0].elements[2].x: expected finite number`.

**Legacy format:** the pre-v1 export (a top-level JSON array of elements) is not supported and is rejected with "This file uses an old format that is no longer supported".

**Import creates a new situation:** the imported situation gets a fresh situation ID, and `createdAt` and `updatedAt` are both set to the import time; frame and element IDs are kept. It replaces the content of the editor (after "Discard changes?" if there are unsaved changes, see 8.7). A file that fails to import changes nothing and is not followed by that question.

Implementation: `frontend/src/lib/model/serialization/` (`SituationSerializer` facade, `SituationFileMigrator` with one `Migration` per version step, e.g. `MigrationV1ToV2`, `SituationFileValidator`, `SituationMapper`); label rules and the predefined positions per sport in `frontend/src/lib/model/positions/PositionCatalog.ts`. Test fixtures for every format version live in `__fixtures__/`, so older files keep being tested.

## 8.4 Editing via commands (undo/redo)

Every change to a **frame's content** (its elements and its description) goes **`SituationEditor` → command → the active frame's `CommandHistory`**. UI components never construct commands or change the model themselves; they call the editor's public methods (`addElement`, `moveElement`, `changeFrameDescription`, `undo`, `redo`, …).

**Situation-level changes** take a second, non-undoable path (`SituationEditor.updateSituation`): adding, deleting, and reordering frames (`addFrame`, `deleteFrame`, `moveFrame`) and the situation's title and description (`changeTitle`, `changeDescription`). Like commands, they refresh `updatedAt` and mark the situation as unsaved (8.7), but they are not recorded in any history; inside the text fields the browser's own undo works while typing. See 8.9 for the frame operations.

- **Commands** work on the immutable model: `execute(frame)` / `undo(frame)` return a new frame and address elements by id, never by reference or index. A command records what it needs to revert itself (e.g. the removed element and its z-order index, a move's start position). Commands that would change nothing (same position/color/type, unknown id) are not recorded. Several commands can be grouped into one undo step with `CompositeCommand`.
- **One history per frame**, keyed by frame id: undo/redo always act on the active frame's history. Switching frames is not an undo step. A new frame starts with an empty history; a deleted frame's history is dropped.
- **Limit:** 200 steps per frame; the oldest steps are dropped. Histories live in memory only and do not survive a page reload.
- **Loading/importing or creating a situation is not undoable** and clears all histories.
- **Edit sessions:** until the history is sealed (`SituationEditor.endGesture()`, called at the end of a drag, when a text field loses focus or Enter is pressed in it, and when the popover closes), a new command may merge into the previous one (`Command.mergeWith`). So consecutive moves of one element during a gesture, or all keystrokes of one text-field focus (e.g. the free-text position label or the frame description), become a single undo step. Picking a position chip is one step of its own. Undo, redo, and switching frames also seal.
- **Undoable vs. not undoable:**

  | Undoable (in the active frame's history) | Not undoable |
  |---|---|
  | Place, move, delete an element; change its type, color, position label | Add, delete, reorder frames |
  | Change the frame description (one step per focus of the field) | Change the situation's title or description |
  | | Switch frames, selection, tool changes; create/load/import a situation |

  After undo, nothing is selected automatically.
- **Feedback:** undo/redo is shown only via the enabled state of the Undo/Redo buttons; what was undone/redone is logged to the debug notification log, not shown as user-facing UI. Undo/redo with nothing to undo/redo (e.g. via the keyboard shortcut) does nothing and logs nothing.
- **Shortcuts:** Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Ignored while typing in text fields, during IME composition, with Alt held, and while an element is being dragged.

Implementation: `frontend/src/lib/history/` (generic: `Command`, `CommandHistory`, `CompositeCommand`, `FrameHistories`, `UndoRedoShortcuts`) and `frontend/src/lib/commands/` (one class per frame command).

## 8.5 Touch interaction concept

The board editor is fully usable by touch on phones (portrait and landscape) and tablets, and with mouse and keyboard on desktop. Touch, mouse, and pen share one interaction model; there is no separate "mobile mode".

**Gestures** (all devices):

| Gesture | Effect |
|---|---|
| Tap/click on an element | Selects it **and** opens the edit popover (type; for players also color and position label; Delete). Same with any tool active: a tap on an element never places a new element on top of it. |
| Tap/click on the empty field, placement tool active | Places an element there (Player in the selected player color, everything else neutral). The tool stays active; the new element is **not** selected. Clears the selection. |
| Tap/click on the empty field, Move tool | Clears the selection and closes the popover. |
| Drag an element | Moves it; one drag = one undo step. The popover closes while dragging, the selection stays. Elements can't be dragged out of the visible area (the field, or the visible half — see 8.6). |
| Right-click / long-press on an element | Same as a tap. |
| Delete button in the popover | Deletes the element. |
| Close button in the popover | Closes the popover **and** clears the selection (like Escape). |
| Desktop only: Shift+click, Delete/Backspace, Escape | Shift+click deletes the clicked element; Delete/Backspace deletes the selected element; Escape clears the selection and closes the popover. Ignored while typing in a text field (e.g. the position label field), so Delete/Backspace there edits the text and never deletes the element. |

A press only turns into a drag after the pointer has moved 6 CSS px (Konva `dragDistance`), so finger jitter doesn't move elements. Taps use Konva's `pointerclick`, which fires for mouse, touch, and pen alike and not after a drag.

**Popover lifetime:** the popover stays open when the tool changes and when the device is rotated or the window resized. Whenever the stage geometry changes (refit, window resize), `BoardCanvas` asks `BoardInteractionController.relocatePopover` to re-anchor it at the selected element's new on-screen position, so it never floats at a stale place. It closes on a tap on the empty field, Escape, Close, undo/redo, the start of a drag, and deleting the element.

**Position labels on the board:** a player's label is drawn centered on it in black or white, whichever contrasts more with the fill (`LabelContrast`, WCAG luminance; oklch, hex and rgb fills understood, others fall back to black). The text node does not listen to pointer events, so taps and drags hit the player beneath; it follows the player while dragged and is counter-rotated against the stage, so it stays upright on the rotated half field.

**Hit-area rule:** elements are drawn in scene units and scale with the field, so they look the same (proportional) on every device. Their invisible hit area is a solid circle of radius `max(visual radius, 22 CSS px / scale)`, i.e. at least 44 CSS px across on screen. Where hit areas of nearby elements overlap, the topmost element wins; a tap inside an element's enlarged hit area selects it rather than placing a new element.

**Field fitting:** the visible part of the field is scaled uniformly as large as fits and centered, re-fitted whenever its container changes size. The full field (2000 × 1000 scene units) is scaled by `min(available width / 2000, available height / 1000)` and never rotated — on a portrait phone it stays horizontal and becomes small. The half field is shown in portrait (see 8.6).

**No pinch-zoom (MVP):** the board area disables browser touch gestures (`touch-action: none`), so pinching neither zooms the page nor the board. See [known limitations](../known-limitations.md).

**Layout:** desktop (≥ 1024 px) has a side tool panel on the left and the details panel (8.9) on the right; tablets (600–1023 px) keep the side tool panel with tighter spacing and, in portrait (≥ 500 px tall), show the details panel below the board so the field keeps the width; portrait phones (≤ 599 px wide) get a compact header with icon-only buttons and the tools as a horizontally scrollable bottom bar; landscape phones (≤ 499 px tall) get a compact header and a narrow left tool rail. On phones the details panel collapses to a "Details" bar above the board (collapsed by default) and the edit popover becomes a bottom sheet. The frame strip (8.9) sits directly below the board on every layout; its action buttons become icon-only when the strip is narrower than 720 px (CSS container query). Interactive controls are at least 44 × 44 CSS px; icon-only buttons keep their text as accessible name. Safe-area insets (notches, home indicator) are respected.

Implementation: `frontend/src/lib/board/` (`BoardViewport`, `BoardInteractionController`, `Selection`, `ToolState`, `PopoverState`, `konvaSetup`), `frontend/src/lib/components/board/BoardCanvas.svelte` (translates Konva events into gestures), `frontend/src/lib/components/board/popover/`.

## 8.6 Field viewport and coordinate convention

**Scene coordinates:** the model stores every position in full-field scene units of the sport, origin top-left, x to the right, y down (`FieldDimensions`, floorball 2000 × 1000). This holds for half-field situations too, so a half-field situation's data is unambiguous and the drawing code is the same for both field types.

**Half-field convention:** a half-field situation always uses the **right half**, `x ∈ [width / 2, width]` (floorball: `x ∈ [1000, 2000]`, `y ∈ [0, 1000]`). The user never chooses a half. Elements outside the visible half (e.g. from a hand-edited or full-field-derived file) stay in the data unchanged; they are simply not visible.

**Viewport** (`BoardViewport`, one per sport + field type):

| | Visible rect (scene units) | Stage rotation | Orientation on screen |
|---|---|---|---|
| Full field | `(0, 0, 2000, 1000)` | 0° | landscape, never rotated |
| Half field | `(1000, 0, 1000, 1000)` | 90° clockwise | portrait, the half's goal (x = 2000) at the **bottom**, the center line at the top |

- The visible rect is scaled uniformly to fit the container (`fit`); for the half field the rect's width and height swap on screen. The Konva stage gets flat `scaleX`/`scaleY`, `rotation`, `x`, `y` props so that the visible rect fills the stage exactly. The whole field is still drawn; the stage's size crops everything outside the visible rect.
- Mapping (stage CSS px relative to the stage container ↔ scene): `stage = (x₀, y₀) + R(θ)·scale·scene`, with `R(90°)·(x, y) = (−y, x)`. `BoardViewport.sceneToStage`/`stageToScene` implement it; taps are converted with `stageToScene`, popover anchors with `sceneToStage` (round elements, so the anchor rect stays axis-aligned). Konva's own transform for dragging uses the same stage props; tests check that both agree.
- **Clamping:** placing and dragging clamp to the visible rect — the whole field for full-field situations, the visible half for half-field ones — so new and moved elements are always visible.

Implementation: `frontend/src/lib/model/FieldDimensions.ts`, `frontend/src/lib/board/BoardViewport.ts`, `frontend/src/lib/components/board/BoardCanvas.svelte`.

## 8.7 Unsaved changes

Until there is server-side storage, "saved" means **exported**.

- `SituationEditor` keeps a simple dirty flag (`hasUnsavedChanges` store, `isDirty()`): it becomes true with any edit that changes the situation (undo and redo included) and false when a situation is created or loaded/imported, or when it is exported (`markSaved()`). It is deliberately a flag, not a comparison: undoing back to the starting state still counts as unsaved.
- Starting a new situation (start page or editor) or importing a file while dirty asks **"Discard changes?"** (Discard / Cancel, reusable `ConfirmDialog`). Confirm proceeds, Cancel (or Escape) keeps the current situation. For an import the question comes after the file was read successfully.
- While dirty, a `beforeunload` handler (`UnsavedChangesGuard`) makes the browser show its own warning when the page is left or reloaded. In-app navigation between the start page and the editor keeps the situation in memory and is not affected.

## 8.8 App navigation

- `/` is the **start page**: "New situation" (opens the New situation dialog: title + Full/Half field, Full preselected) and "Import" (file picker). Creating or importing navigates to the editor. A "Saved situations" section is the placeholder for the Phase 2 list of saved situations and teams.
- `/editor` is the **board editor** (client-only, `ssr = false`). Its header has New (same flow as on the start page), Load, Export, Undo, Redo.
- The edited situation lives in the `situationEditor` singleton, so it survives client-side navigation between both pages. Opening `/editor` without a situation (directly, or after a reload, which loses the in-memory state) redirects to `/`.
- Dialogs are native `<dialog>` elements opened modally (`modalDialog` action): focus moves into the dialog on open and back to the opener on close, Escape cancels, and page-wide keyboard shortcuts (undo/redo, Delete) are ignored while focus is inside a modal dialog.

Implementation: `frontend/src/routes/` (`+page.svelte` start page, `editor/`), `frontend/src/lib/editor/` (`SituationWorkflow`, `NewSituationForm`, `UnsavedChangesGuard`), `frontend/src/lib/dialogs/ConfirmationPrompt.ts`, `frontend/src/lib/components/dialogs/`, `frontend/src/lib/actions/modalDialog.ts`.

## 8.9 Frames and the details panel

**Frame operations** (all through `SituationEditor`, none undoable, all refresh `updatedAt` and mark the situation unsaved):

| Operation | Rule |
|---|---|
| Add | Inserts a copy of the **active** frame right after it — same elements with the same element ids, same description, new frame id — and makes the copy active. The copy starts with an empty undo history; the source frame's edit session ends (its history is sealed, its steps stay). From then on the frames are independent: a change in one frame never propagates to another. No limit on the number of frames. |
| Delete | After the confirmation "Delete frame?" (Delete / Cancel, the shared `ConfirmDialog`). The last remaining frame can't be deleted (the button is disabled). If the active frame is deleted, the previous frame becomes active (the next one if it was the first); deleting another frame keeps the active one. The deleted frame's undo history is dropped. The strip's Delete button always deletes the active frame. |
| Reorder | Moves a frame to another position; the active frame stays the same frame (it may get a new number). |
| Switch | Not an undo step; seals the edit session. The edit popover closes and the selection is cleared, because element ids repeat across frames. |

Frame numbers are 1-based positions and change with the order; frames have no names. The file format needs no change for this: frame order and descriptions were already part of format version 2 (8.3).

**Frame strip** (`FrameStrip`): a `<nav aria-label="Frames">` with an ordered list; each frame is a button showing its number and a thumbnail, the active one with `aria-current="step"`. It scrolls horizontally when the frames don't fit and keeps the active frame in view. Actions: Move frame left/right, Add frame, Delete frame.

- **Thumbnails** (`FrameThumbnail`, geometry in `FrameThumbnailGeometry`): a small inline SVG rendering of the field markings and the frame's elements from the model, oriented like the board (full field landscape; half field portrait with its goal at the bottom, via `BoardViewport`). Elements are drawn 2.5× their board size so they stay visible; labels are not drawn. SVG (instead of an offscreen Konva stage) keeps thumbnails cheap, crisp at any size, re-rendered reactively when the frame changes, and testable in jsdom.
- **Reorder by drag and drop** (`FrameReorderGesture`, a pure state machine fed by Pointer Events, so it works for mouse, pen, and touch, unlike HTML5 drag and drop): with mouse/pen a drag starts after the pointer moved 8 CSS px (less is a tap, which selects the frame); with touch the finger has to rest for 400 ms first (a long press), so a quick swipe still scrolls the strip. While dragging, the frame follows the pointer, the others make room, and the strip auto-scrolls near its edges; the target position is the number of other frames whose center lies before the dragged frame's center. pointercancel, lost pointer capture, and Escape cancel without reordering; the click that follows a drag doesn't select.
- **Keyboard alternative:** the "Move frame left" / "Move frame right" buttons move the active frame by one position (also usable by touch). Keyboard/swipe frame *switching* is not part of the MVP.

**Details panel** (`SituationDetails`): an `<aside>` named "Details" with the situation's title (`<input>`) and description (`<textarea>`), plus the active frame's description (`FrameDescriptionEditor`, labelled "Frame N description"). Descriptions are edited as Markdown source; nothing is rendered yet. Title and situation description are stored on every input and are not undoable (a blank title is stored as is and shown as "Untitled Situation"); the frame description is one undo step per focus of the field (blur ends the session). Keyboard shortcuts (undo/redo, Delete/Backspace) are ignored while typing in these fields (8.4, 8.5). The header keeps showing the title.

Implementation: `frontend/src/lib/editor/SituationEditor.ts`, `frontend/src/lib/editor/FrameWorkflow.ts` (confirmation, popover/selection reset), `frontend/src/lib/commands/ChangeFrameDescriptionCommand.ts`, `frontend/src/lib/components/frames/`, `frontend/src/lib/components/details/SituationDetails.svelte`.
