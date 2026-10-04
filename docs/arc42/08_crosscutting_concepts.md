# 8. Cross-cutting Concepts

## 8.1 Authorization Concept

There are two levels of roles:

- **System-wide:** *system administrator* or *normal user*. Any user can create a team.
- **Per team:** **Admin**, **Editor**, **Reader**. These apply across the Teams, Folders, and Situations modules (chapter 5). The creator of a team becomes its Admin. Members whose join request is accepted start as Reader.
- **Personal area:** only its owner can read and write it.

**System administrators** manage users and teams, but have **no access to situations or folders** (neither personal nor team):

| Action | System administrator |
|---|---|
| List users, block/unblock, delete a user | ✅ |
| Grant/revoke system administrator | ✅ (the last system administrator can't lose the role, block or delete themselves) |
| List teams, delete a team | ✅ |
| Manage a team's members and roles (also accept/reject join requests) | ✅ |
| View or change situations and folders | ❌ |

A blocked user can't log in or call the API; their content and memberships stay.

**Team permission matrix (confirmed):**

| Action | Admin | Editor | Reader |
|---|---|---|---|
| View team's boards/folders | ✅ | ✅ | ✅ |
| Create/edit/delete a board | ✅ | ✅ | ❌ |
| Create/rename/delete a folder | ✅ | ✅ | ❌ |
| Accept/reject join requests | ✅ | ❌ | ❌ |
| Manage team members/roles (remove members, change roles, own role included²) | ✅ | ❌ | ❌ |
| See the member list | ✅ | ✅ | ✅ |
| Leave the team | ✅¹ | ✅ | ✅ |
| Delete the team | ✅ | ❌ | ❌ |

¹ Except the team's last Admin, who has to delete the team instead.
² As long as the team keeps at least one Admin.

Enforcement point: the backend. The Teams module owns the role check; Situations and Folders ask the Areas module, which delegates to Teams or Users (ch. 5.2), rather than duplicating authorization logic. The frontend only hides what isn't allowed.

## 8.2 API Error Handling

Confirmed: consistent error responses using [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807) (`application/problem+json`), which ASP.NET Core supports natively. Validation errors list the invalid fields (`errors`); domain errors (e.g. duplicate title, save conflict, last Admin) have their own `type` URI so the frontend can react to them.

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

**Format version 3** (current):

```json
{
  "format": "tacticalboard.situation",
  "formatVersion": 3,
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
          { "id": "…", "type": "Pass", "color": "oklch(15% 0 0)", "start": { "x": 1200, "y": 300 }, "end": { "x": 1600, "y": 500 }, "bends": [{ "x": 1450, "y": 300 }] },
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
- Element `type`: the **point elements** `Player`, `Ball`, `Rectangle`, `Triangle`, `Circle` (with `x`, `y`, `label`) and the **arrows** `Pass`, `Run`, `Shot` (with `start`, `end`, `bends`; no `x`/`y`/`label`). The validator checks the properties of the element's kind; extra properties (also `x`/`y`/`label` on an arrow) are ignored. There are no rules on how many of each a frame may contain. The order of `elements` is the z-order (bottom first); arrows are nevertheless always drawn below point elements.
- **Coordinates** (`x`, `y`, and every point of an arrow) are always in full-field scene units of the sport (floorball: 2000 × 1000, origin top-left), also for half-field situations. A half-field situation uses the right half, `x ∈ [1000, 2000]` (see 8.6).
- Arrow `start`, `end`: `{ "x": …, "y": … }` with finite numbers. `bends`: the **bend points** the curve passes through, in order from start to end; `[]` for a straight arrow; any number. Start and end may coincide (the app itself never creates such an arrow, see 8.10).
- Element `label` (point elements only): the **position label**, `""` (no label) or 1–2 characters, each a letter or a digit (e.g. `C`, `LV`, `10`). Stored per element **per frame**, like the color; duplicates within a frame are allowed. Every element type carries it, but only players show it: changing a player to another type hides the label, changing it back shows it again. The UI upper-cases typed letters; the importer also accepts lower case and keeps it as is.
- Unknown extra properties are ignored on import.

**Format history:**

| Version | Change | Migration from the previous version |
|---|---|---|
| 1 | Initial situation format | – |
| 2 | Elements get `label` | `MigrationV1ToV2`: every element gets `"label": ""` (a `label` property in a v1 file was an ignored extra property and is replaced) |
| 3 | Arrow elements `Pass`, `Run`, `Shot` with `start`, `end`, `bends` | `MigrationV2ToV3`: none needed — v2 files contain no arrows (the types were unknown) and point elements are unchanged; the content passes through, only `formatVersion` changes |

**Versioning and migration policy:** every change to the file format bumps `formatVersion` and comes with a migration from the previous version, so files exported by older app versions keep importing. Import runs parse → migrate (chained, one version step at a time) → validate → map to the domain model. Files with a newer version than the app supports are rejected with a request to update the app. The validator reports all problems at once, with paths such as `situation.frames[0].elements[2].x: expected finite number`.

**Legacy format:** the pre-v1 export (a top-level JSON array of elements) is not supported and is rejected with "This file uses an old format that is no longer supported".

**Import creates a new situation:** the imported situation gets a fresh situation ID, and `createdAt` and `updatedAt` are both set to the import time; frame and element IDs are kept. It replaces the content of the editor (after "Discard changes?" if there are unsaved changes, see 8.7). A file that fails to import changes nothing and is not followed by that question.

Implementation: `frontend/src/lib/model/serialization/` (`SituationSerializer` facade, `SituationFileMigrator` with one `Migration` per version step: `MigrationV1ToV2`, `MigrationV2ToV3`; `SituationFileValidator`, `SituationMapper`); label rules and the predefined positions per sport in `frontend/src/lib/model/positions/PositionCatalog.ts`. Test fixtures for every format version live in `__fixtures__/`, so older files keep being tested.

## 8.4 Editing via commands (undo/redo)

Every change to a **frame's content** (its elements and its description) goes **`SituationEditor` → command → the active frame's `CommandHistory`**. UI components never construct commands or change the model themselves; they call the editor's public methods (`addElement`, `moveElement`, `addArrow`, `reshapeArrow`, `moveArrow`, `addBend`, `removeBend`, `straightenArrow`, `changeFrameDescription`, `undo`, `redo`, …).

**Situation-level changes** take a second, non-undoable path (`SituationEditor.updateSituation`): adding, deleting, and reordering frames (`addFrame`, `deleteFrame`, `moveFrame`) and the situation's title and description (`changeTitle`, `changeDescription`). Like commands, they refresh `updatedAt` and mark the situation as unsaved (8.7), but they are not recorded in any history; inside the text fields the browser's own undo works while typing. See 8.9 for the frame operations.

- **Commands** work on the immutable model: `execute(frame)` / `undo(frame)` return a new frame and address elements by id, never by reference or index. A command records what it needs to revert itself (e.g. the removed element and its z-order index, a move's start position). Commands that would change nothing (same position/color/type/shape, unknown id) are not recorded. A type change is only possible within the element's family (point types among each other, arrow types among each other); `ChangeElementTypeCommand` refuses anything else. All arrow shape changes — dragging its start, end or a bend, adding/removing bends, straightening, moving the whole arrow — are one command type, `ReshapeArrowCommand` (old and new `ArrowGeometry`). Several commands can be grouped into one undo step with `CompositeCommand`.
- **One history per frame**, keyed by frame id: undo/redo always act on the active frame's history. Switching frames is not an undo step. A new frame starts with an empty history; a deleted frame's history is dropped.
- **Limit:** 200 steps per frame; the oldest steps are dropped. Histories live in memory only and do not survive a page reload.
- **Loading/importing or creating a situation is not undoable** and clears all histories.
- **Edit sessions:** until the history is sealed (`SituationEditor.endGesture()`, called at the end of a drag, when a text field loses focus or Enter is pressed in it, and when the popover closes), a new command may merge into the previous one (`Command.mergeWith`). So consecutive moves of one element during a gesture, all reshapes of one arrow during a handle or body drag, or all keystrokes of one text-field focus (e.g. the free-text position label or the frame description), become a single undo step. Picking a position chip is one step of its own; so are adding a bend, removing a bend and straightening (the editor seals before and after them). Undo, redo, and switching frames also seal.
- **Undoable vs. not undoable:**

  | Undoable (in the active frame's history) | Not undoable |
  |---|---|
  | Place, move, delete an element; change its type, color, position label | Add, delete, reorder frames |
  | Draw an arrow; move it; drag its start, end or a bend; add or remove a bend; straighten it | Arrow drawing in progress (start point, preview) |
  | Change the frame description (one step per focus of the field) | Change the situation's title or description |
  | | Switch frames, selection, tool changes; create/load/import a situation |

  After undo, nothing is selected automatically.
- **Feedback:** undo/redo is shown only via the enabled state of the Undo/Redo buttons; what was undone/redone is logged to the debug notification log, not shown as user-facing UI. Undo/redo with nothing to undo/redo (e.g. via the keyboard shortcut) does nothing and logs nothing.
- **Shortcuts:** Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Ignored while typing in text fields, during IME composition, with Alt held, and while an element is being dragged.

Implementation: `frontend/src/lib/history/` (generic: `Command`, `CommandHistory`, `CompositeCommand`, `FrameHistories`, `UndoRedoShortcuts`) and `frontend/src/lib/commands/` (one class per frame command).

## 8.5 Touch interaction concept

The board editor is fully usable by touch on phones (portrait and landscape) and tablets, and with mouse and keyboard on desktop. Touch, mouse, and pen share one interaction model; there is no separate "mobile mode".

**Gestures** (all devices; drawing and editing arrows: see 8.10):

| Gesture | Effect |
|---|---|
| Tap/click on an element | Selects it **and** opens the edit popover (type within its family, color, for players the position label, for arrows the bend actions; Delete). Same with any tool active: a tap on an element never places a new element on top of it (with an arrow tool only while no arrow start point is pending, see 8.10). |
| Tap/click on the empty field, point placement tool active | Places an element there (Player in the selected player color, everything else neutral). The tool stays active; the new element is **not** selected. Clears the selection. |
| Tap/click on the empty field, Move tool | Clears the selection and closes the popover. |
| Drag an element | Moves it (an arrow as a whole, keeping its shape); one drag = one undo step. The popover closes while dragging, the selection stays. Elements can't be dragged out of the visible area (the field, or the visible half — see 8.6). Not with an arrow tool active: a press then starts an arrow (8.10). |
| Right-click / long-press on an element | Same as a tap. |
| Delete button in the popover | Deletes the element. |
| Close button in the popover | Closes the popover **and** clears the selection (like Escape). |
| Desktop only: Shift+click, Delete/Backspace, Escape | Shift+click deletes the clicked element; Delete/Backspace deletes the selected element; Escape drops an arrow being drawn, clears the selection and closes the popover. Ignored while typing in a text field (e.g. the position label field), so Delete/Backspace there edits the text and never deletes the element. |

A press only turns into a drag after the pointer has moved 6 CSS px (Konva `dragDistance`), so finger jitter doesn't move elements. Taps use Konva's `pointerclick`, which fires for mouse, touch, and pen alike and not after a drag.

**Popover lifetime:** the popover stays open when the tool changes and when the device is rotated or the window resized. Whenever the stage geometry changes (refit, window resize), `BoardCanvas` asks `BoardInteractionController.relocatePopover` to re-anchor it at the selected element's new on-screen position, so it never floats at a stale place. It closes on a tap on the empty field, Escape, Close, undo/redo, the start of a drag (also of an arrow handle), deleting the element, and "Edit shape" (arrows; keeps the selection, see 8.10).

**Popover placement** (`PopoverPlacement`, larger screens): below the anchor (the element's on-screen bounds, for an arrow the bounds of its curve), horizontally centered; above it when there is no room below; to its right or left, vertically centered, when it fits neither below nor above (typical for a large arrow) — so it doesn't cover the element. Only when it fits nowhere it may overlap the element. On phones it is a bottom sheet instead.

**Position labels on the board:** a player's label is drawn centered on it in black or white, whichever contrasts more with the fill (`LabelContrast`, WCAG luminance; oklch, hex and rgb fills understood, others fall back to black). The text node does not listen to pointer events, so taps and drags hit the player beneath; it follows the player while dragged and is counter-rotated against the stage, so it stays upright on the rotated half field.

**Hit-area rule:** elements are drawn in scene units and scale with the field, so they look the same (proportional) on every device. Their invisible hit area is a solid circle of radius `max(visual radius, 22 CSS px / scale)`, i.e. at least 44 CSS px across on screen. An arrow's hit area is its curve stroked 44 CSS px wide; the handles of the selected arrow have hit circles of 44 CSS px. Where hit areas of nearby elements overlap, the topmost element wins; a tap inside an element's enlarged hit area selects it rather than placing a new element.

**Field fitting:** the visible part of the field is scaled uniformly as large as fits and centered, re-fitted whenever its container changes size. The full field (2000 × 1000 scene units) is scaled by `min(available width / 2000, available height / 1000)` and never rotated — on a portrait phone it stays horizontal and becomes small. The half field is shown in portrait (see 8.6).

**No pinch-zoom (MVP):** the board area disables browser touch gestures (`touch-action: none`), so pinching neither zooms the page nor the board. See [known limitations](../known-limitations.md).

**Layout:** desktop (≥ 1024 px) has a side tool panel on the left and the details panel (8.9) on the right; tablets (600–1023 px) keep the side tool panel with tighter spacing and, in portrait (≥ 500 px tall), show the details panel below the board so the field keeps the width; portrait phones (≤ 599 px wide) get a compact header with icon-only buttons and the tools as a horizontally scrollable bottom bar; landscape phones (≤ 499 px tall) get a compact header and a narrow left tool rail. On phones the details panel collapses to a "Details" bar above the board (collapsed by default) and the edit popover becomes a bottom sheet. The playback controls (8.11) and the frame strip (8.9) sit directly below the board on every layout (on landscape phones at least 780 px wide side by side, to save height); its action buttons become icon-only when the strip is narrower than 720 px (CSS container query). Interactive controls are at least 44 × 44 CSS px; icon-only buttons keep their text as accessible name. Safe-area insets (notches, home indicator) are respected.

Implementation: `frontend/src/lib/board/` (`BoardViewport`, `BoardInteractionController`, `ArrowGestures`, `ArrowHandle`, `Selection`, `ToolState`, `PopoverState`, `konvaSetup`), `frontend/src/lib/components/board/BoardCanvas.svelte` (translates Konva events into gestures), `frontend/src/lib/components/board/popover/`.

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

Implementation: `frontend/src/lib/model/FieldDimensions.ts`, `frontend/src/lib/board/BoardViewport.ts`, `frontend/src/lib/components/board/BoardCanvas.svelte` (interaction) on top of `BoardScene.svelte` (the drawing, shared with the GIF export, see 8.12).

## 8.7 Unsaved changes

Until there is server-side storage, "saved" means **exported**. From Phase 2, for a situation saved on the server it means saved there (ch. 8.15); in local mode (no login) it stays "exported".

- `SituationEditor` keeps a simple dirty flag (`hasUnsavedChanges` store, `isDirty()`): it becomes true with any edit that changes the situation (undo and redo included) and false when a situation is created or loaded/imported, or when it is exported as JSON (`markSaved()`). Exporting an animated GIF does **not** count as saving (8.12). It is deliberately a flag, not a comparison: undoing back to the starting state still counts as unsaved.
- Starting a new situation (start page or editor), importing a file, or going back to the start page with the editor's badge while dirty asks **"Discard changes?"** (Discard / Cancel, reusable `ConfirmDialog`). Confirm proceeds, Cancel (or Escape) keeps the current situation. For an import the question comes after the file was read successfully.
- While dirty, a `beforeunload` handler (`UnsavedChangesGuard`) makes the browser show its own warning when the page is left or reloaded. Other in-app navigation (e.g. the browser's Back button from the editor to the start page) keeps the situation in memory and is not affected.

## 8.8 App navigation

- `/` is the **start page**: "New situation" (opens the New situation dialog: title + Full/Half field, Full preselected) and "Import" (file picker). Creating or importing navigates to the editor. A "Saved situations" section is the placeholder for the Phase 2 list of saved situations and teams.
- `/editor` is the **board editor** (client-only, `ssr = false`). Its header has the app badge, New (same flow as on the start page), Load, Export, Undo, Redo.
- The **badge** (top left, a link named "Start page") goes back to the start page: after "Discard changes?" if there are unsaved changes (Cancel stays in the editor), then the situation is **closed** (`SituationWorkflow.leave` → `SituationEditor.close`): it is dropped, so its changes are really discarded and the unload warning no longer applies. A click with a modifier key (e.g. open in a new tab) is left to the browser.
- The edited situation lives in the `situationEditor` singleton, so it survives other client-side navigation between both pages (e.g. the browser's Back button). Opening `/editor` without a situation (directly, or after a reload, which loses the in-memory state) redirects to `/`.
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

- **Thumbnails** (`FrameThumbnail`, geometry in `FrameThumbnailGeometry`): a small inline SVG rendering of the field markings and the frame's elements from the model, oriented like the board (full field landscape; half field portrait with its goal at the bottom, via `BoardViewport`). Elements are drawn 2.5× their board size so they stay visible, arrows (below the other elements) with their board styles enlarged the same way; labels are not drawn. SVG (instead of an offscreen Konva stage) keeps thumbnails cheap, crisp at any size, re-rendered reactively when the frame changes, and testable in jsdom.
- **Reorder by drag and drop** (`FrameReorderGesture`, a pure state machine fed by Pointer Events, so it works for mouse, pen, and touch, unlike HTML5 drag and drop): with mouse/pen a drag starts after the pointer moved 8 CSS px (less is a tap, which selects the frame); with touch the finger has to rest for 400 ms first (a long press), so a quick swipe still scrolls the strip. While dragging, the frame follows the pointer, the others make room, and the strip auto-scrolls near its edges; the target position is the number of other frames whose center lies before the dragged frame's center. pointercancel, lost pointer capture, and Escape cancel without reordering; the click that follows a drag doesn't select.
- **Keyboard alternative:** the "Move frame left" / "Move frame right" buttons move the active frame by one position (also usable by touch). Keyboard/swipe frame *switching* is not part of the MVP.

**Details panel** (`SituationDetails`): an `<aside>` named "Details" with the situation's title (`<input>`) and description (`<textarea>`), plus the active frame's description (`FrameDescriptionEditor`, labelled "Frame N description"). Descriptions are edited as Markdown source; nothing is rendered yet. Title and situation description are stored on every input and are not undoable (a blank title is stored as is and shown as "Untitled Situation"); the frame description is one undo step per focus of the field (blur ends the session). Keyboard shortcuts (undo/redo, Delete/Backspace) are ignored while typing in these fields (8.4, 8.5). The header keeps showing the title.

Implementation: `frontend/src/lib/editor/SituationEditor.ts`, `frontend/src/lib/editor/FrameWorkflow.ts` (confirmation, popover/selection reset), `frontend/src/lib/commands/ChangeFrameDescriptionCommand.ts`, `frontend/src/lib/components/frames/`, `frontend/src/lib/components/details/SituationDetails.svelte`.

## 8.10 Arrows

Arrows (`Pass`, `Run`, `Shot`) are elements like players and markers (stable id, per-frame copy, color, undoable edits), but they are drawn from a start to an end point and can be bent. They are free: not attached to players, they don't follow them. They have no label.

**Model** (`ArrowElement`, `ArrowGeometry`): `start`, `end` and an ordered list of **bend points** the curve passes through (none = straight; any number). The curve is a **uniform Catmull-Rom spline** through start → bends → end, converted to one cubic Bézier per segment (the end points are duplicated as phantom neighbours). It passes exactly through every bend, so a dragged bend stays under the finger, it is smooth at every bend, and without bends it is a straight line. `ArrowGeometry` is a pure value class: sampling, end tangent (for the arrowhead), bounds, translate/clamp, insert/move/remove a bend, straighten.

**Rendering** (`ArrowPainter`, pure, used by the board and the frame thumbnails): fixed styles per type in scene units — Pass dashed (width 4), Run wavy (width 4, a sine wave along the curve that fades in and out), Shot thick (width 9) — and the same filled arrowhead for all types (length 26), oriented along the curve's end tangent; the line stops under the head. Arrows are drawn in their own group **below** the point elements (one Konva layer: arrows, point elements, overlay), whatever their position in the frame's element list. Thumbnails draw them as SVG with the same styles, enlarged like the other elements.

**Drawing** (arrow tool active; `ArrowGestures`, a pure state machine owned by `BoardInteractionController`):

| Gesture (arrow tool active) | Effect |
|---|---|
| Press and drag (≥ 6 CSS px), release | Draws an arrow from the press point to the release point; a translucent preview follows the pointer. Also when the press is on a player or another element: players and markers aren't draggable while an arrow tool is active. |
| Tap on the empty field | Sets the **start point** (a marker is shown); clears the selection and closes the popover. |
| With a start point set: tap anywhere (also on an element), or drag and release | Sets the **end point** there and draws the arrow. With a mouse the preview follows the hovering pointer. |
| Tap on an element (no start point set) | Selects it and opens the popover, as with every other tool. |
| Escape, changing the tool, pointercancel, a second finger | Cancels the arrow being drawn (and a set start point). |

A new arrow is black (`ElementCatalog.arrowColor`) and of the active type; the tool stays active and the new arrow is **not** selected. Arrows shorter than 24 CSS px on screen are discarded. Start and end are clamped to the visible area (the field, or the visible half). Drawing an arrow is one undo step.

**Editing a selected arrow** (any tool): the selected arrow shows **handles** — its start, its end, every bend, and a small "+" (**add bend** handle) in the middle of every segment. Handles keep their on-screen size and have 44 CSS px hit circles; the "+" handles lie below the others.

| Gesture | Effect |
|---|---|
| Drag the start, the end or a bend | Moves that point (clamped to the visible area); live preview, one undo step on drop. |
| Drag a "+" | Inserts a new bend there (one undo step "Add bend"). |
| Tap a "+" | Inserts a bend at the middle of that segment. |
| Tap a bend | Makes it the **active bend** (highlighted) and opens the popover, which offers **Remove bend**. |
| Double-tap / double-click a bend | Removes it. |
| Drag the arrow's line | Moves the whole arrow, keeping its shape; it stops where any of its points would leave the visible area. |

The arrow popover ("Edit arrow") offers Type (Pass/Run/Shot only — the type can't change between arrows and point elements), Color (the palette, see below), and under **Bends**: **Edit shape** (closes the popover but keeps the arrow selected, so the handles stay usable — needed on phones, where the bottom sheet can cover the board; Close clears the selection like for every element), **Remove bend** (only with an active bend), **Straighten** (only when bent; removes all bends), and Delete arrow. Adding a bend, removing a bend and straightening are undo steps of their own.

**Colors:** every element's color can be changed in its popover (Player color / Color), from one palette: the four player colors, grey (the initial color of markers and the ball) and black (the initial color of arrows). The point element popover lists only point types, the arrow popover only arrow types.

Implementation: `frontend/src/lib/model/elements/` (`ArrowElement`, `ArrowGeometry`, `ElementType`), `frontend/src/lib/commands/ReshapeArrowCommand.ts`, `frontend/src/lib/board/` (`ArrowGestures`, `ArrowHandle`, `BoardInteractionController`, `Selection` with the active bend), `frontend/src/lib/components/board/` (`ArrowPainter`, `ArrowShape`, `ArrowHandleShape`, `ArrowDraftPreview`, `BoardCanvas`), `frontend/src/lib/components/frames/FrameThumbnailGeometry.ts`.

## 8.11 Playback

The frames of a situation can be played as a **slideshow** in the editor.

**Rules:**

| | |
|---|---|
| Start | Play always starts at **frame 1**, whatever frame is active. Play is disabled (and Space does nothing) with only one frame. |
| Timing | Every frame is shown for the same **frame duration** — one global setting, 1 / 2 / 3 / 5 s, default 2 s. Hard cut between frames (no transition). |
| End | After the last frame playback **stops**, or starts over at frame 1 when **Loop** is on (default off). |
| Stop | Stop (or the natural end) shows the frame that was active **before** playback again. Playback never changes the model or the active frame: the board just shows the slideshow's frame while it runs. |
| Pause | Keeps the shown frame; Play resumes it with the time it had left. |
| Previous / Next | Show the neighbouring frame for its full duration, staying playing or paused; nothing happens before the first or after the last frame (also with Loop on). A tap on a frame in the strip shows that frame the same way. |
| Settings | Frame duration and Loop are **app settings**, not part of the situation file; they are remembered in the browser (`localStorage`, key `tacticalboard.playbackSettings`). If the browser storage is unavailable or holds invalid data, the defaults are used. Changes apply right away, also during playback (a new duration from the next frame on). |

**While playing or paused** the editor is read-only: the board shows the frame without selection, handles or popover and reports no taps, drags or arrow gestures; the tool panel, Undo/Redo (buttons and shortcuts), Delete/Backspace, adding/deleting/reordering frames and the details fields are disabled. Frame descriptions are **not** shown (the frame description field is hidden). Starting playback first ends the edit session, drops an arrow being drawn, clears the selection and closes the popover. New, Load and the badge stay available: when the situation is replaced (new, imported, closed) playback stops. The JSON export works during playback and doesn't stop it; opening the GIF export stops playback first (8.12).

**Controls** (`PlaybackControls`, a region named "Playback" between the board and the frame strip): Play/Pause, Previous frame, Next frame, Stop (all ≥ 44 px), the status "Frame n / N" (the frame on the board), a "Frame duration" select and a Loop toggle button (`aria-pressed`). Below 640 px width (container query) the buttons are icon-only and the status is "n / N"; the texts stay the accessible names. The frame strip marks the frame being shown (`aria-current="step"`).

**Keyboard** (`PlaybackShortcuts`): Space = Play/Pause (also starts playback); ← / → = previous / next frame and Escape = Stop, **only during playback** — outside playback ← / → do nothing (switching frames by keyboard is not part of the MVP) and Escape keeps its board meaning (8.5). Ignored while typing in a text field or select, during IME composition, with Ctrl/Cmd/Alt held, while an element is dragged, and inside modal dialogs. Space on a focused button or link is left to the browser, which activates that control (so it never triggers twice). Swipe gestures and a fullscreen/presentation mode are planned for later.

**Building blocks** (`frontend/src/lib/playback/`, pure; `PlaybackTimeline` is shared with the GIF export, 8.12):

- `PlaybackTimeline`: frames + settings → entries `{ frameId, index, startMs, durationMs }`, `totalMs`, `frameAt(ms)` (a frame covers `[startMs, startMs + durationMs)`; before the start the first frame, from the end on the last one).
- `PlaybackSettings` (immutable value) and `PlaybackSettingsStore` (Svelte store, persisted through a `KeyValueStorage`; `WebKeyValueStorage` wraps `localStorage` and swallows every storage error).
- `SlideshowPlayer`: states `stopped | playing | paused` with the shown index and frame id as a store; `play`/`pause`/`resume`/`toggle`/`stop`/`next`/`previous`/`seek`; reads the timeline and the loop setting from a source whenever it needs them; timers through an injected `Scheduler` (`TimeoutScheduler` in the browser, `FakeScheduler` in tests).
- `PlaybackShortcuts`: the keyboard mapping above.

`frontend/src/lib/editor/PlaybackWorkflow.ts` connects the player to the editor (leave editing before starting, stop when the situation changes); the editor page shows `playing ? the slideshow's frame : the active frame` and passes the read-only state to `BoardCanvas` (`readonly`), `ToolPanel` (`disabled`), `FrameStrip` (`playing`) and `SituationDetails` (`disabled`).

## 8.12 Animation export

The frames of a situation can be exported as an **animated GIF** — the slideshow of 8.11 as a file to send around.

**Rules** (product decisions):

| | |
|---|---|
| Format | GIF only (no video). |
| Content | **All** frames, in order, as they look on the board: field, arrows, point elements, labels. No title, descriptions, frame numbers or watermark are burned in. Elements in the hidden half of a half-field situation are not visible (like on the board). |
| Look | Always the **light** field look (white surface, black lines), also when the app is in the dark theme. |
| Orientation | Full field landscape; half field portrait with its goal at the bottom (like the board; the floorball half is square). |
| Resolution | Selectable preset, given by the long side: **Small 600 px, Medium 1200 px (default), Large 1800 px**; the other side follows the shown field (full floorball field 1200 × 600 at Medium, half field 1200 × 1200). |
| Timing | Every frame is shown for the playback **frame duration** (8.11, shown read-only in the dialog — it *is* the playback setting); hard cuts. The GIF **loops forever**. |
| File | `<slug of the title>.gif`, with the same slug rule as the JSON export (8.3); `situation.gif` when the title has no usable characters. |
| Share | Where the browser can share files (`navigator.canShare({ files })`, typically phones), the dialog additionally offers **Share** (native share sheet). Closing the share sheet is not an error. |
| Saving | Exporting a GIF does **not** count as saved: the unsaved-changes flag (8.7) is untouched. |

**UI:** the header's **Export** button is a disclosure button (`aria-expanded`) with two choices below it, "Situation file (JSON)" and "Animated GIF" (≥ 44 px each; Escape, a press outside or moving focus away closes them). "Animated GIF" opens the modal **Export animated GIF** dialog (native `<dialog>`, `modalDialog` action): Resolution radios (with the pixel size for this situation), Frames and Frame duration as a description list, **Create GIF**. While the GIF is created: a `<progress>` bar ("frame n of N") and **Cancel**; the resolution is locked. Then: **Download** (focused), **Share** where supported, Close. Failures are shown as an alert with "Try again". Escape/Close cancels a running export. Opening the dialog stops a running slideshow, ends the edit session and closes the popover; the export uses the situation as it is at that moment.

**Building blocks** (`frontend/src/lib/export/`):

- `BoardScene.svelte` (`lib/components/board/`): the board's drawing — Konva stage laid out by a `StageFit`, field, arrows group, point elements group with labels, an overlay snippet — with optional `SceneInteraction`. `BoardCanvas` adds interaction and handles on top; the export uses it without interaction. So the GIF is drawn by exactly the same code as the board.
- `FrameRasterizer` (`FrameRendererFactory`): mounts `BoardScene` with Svelte's `mount()` into a hidden, `inert` container outside the viewport, laid out by `BoardViewport.fit` for exactly the export size; per frame: set the elements, `await tick()`, `stage.toCanvas({ pixelRatio: 1 })` (Konva renders each layer separately, so composite operations stay inside their layer as on screen), drawn onto an opaque white ground → RGBA pixels. `dispose()` unmounts and removes the container.
- `ExportResolution`: the presets and `sizeFor(contentSize)` (whole pixels, long side = preset).
- `AnimationEncoder` (interface: `addFrame(rgba, durationMs)`, `finish(): Blob`, `mimeType`, `fileExtension`) with `GifAnimationEncoder`: one GIF frame per slide, delay = frame duration, NETSCAPE loop count 0 (forever); a 256-color palette quantized **per frame** (RGB565, local color tables) — frames are hard cuts, so per-frame palettes keep each frame's colors exact without dithering.
- `SlideshowExporter`: `PlaybackTimeline` (same timing as playback) → rasterizer → encoder; `onProgress(done, total)` (0 … N), cancellation through an `AbortSignal` (rejects with an `AbortError`), yields to the UI (a macrotask) after every frame so progress paints and Cancel stays responsive; the rasterizer is always disposed.
- `AnimationExport` (runes state behind the dialog): phases `idle | rendering | ready | failed`, resolution choice, file naming, Download (`BrowserFileDownloader`) and Share (`WebFileShare`).
- `lib/files/`: `BrowserFileDownloader` (any `Blob`, through an object URL revoked 40 s after the click; also used by the JSON export), `FileNameSlug` (the shared slug rule), `WebFileShare` (feature-detected Web Share API with files).

**Dependency:** [gifenc](https://github.com/mattdesl/gifenc) (MIT, ~9 kB, no dependencies) encodes the GIF. It is loaded with a dynamic `import()` only when a GIF is created, so it is a separate chunk and the editor bundle doesn't grow. It ships no TypeScript types; the used API is declared in `frontend/src/lib/export/gifenc.d.ts`.

**Performance:** rendering and encoding run on the main thread, one frame at a time (in headless Chromium about 0.1–0.3 s for 3 frames, depending on the resolution); see [known limitations](../known-limitations.md).


## 8.13 Login and session (Phase 2)

- The backend is the OIDC client (ADR-006): `GET /auth/login?returnUrl=…` starts the Authorization Code flow with PKCE, `/auth/callback` finishes it, `POST /auth/logout` ends the session (and at the IdP, if it supports it). `returnUrl` must be a local path.
- The session is an `HttpOnly`, `Secure`, `SameSite=Lax` cookie under the app's origin. The IdP tokens stay in the backend.
- **CSRF:** every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) needs an antiforgery token header that the frontend gets from the backend; together with `SameSite=Lax` this blocks cross-site requests.
- `GET /api/me` returns the current user, or `401` when not logged in. The frontend then offers "Log in" and keeps working in local mode (ch. 1).
- **Users** are identified by the IdP's issuer + `sub`. The first valid login creates a normal user (just-in-time). The display name comes from the `name` claim (fallbacks: `preferred_username`, then `email`) on that first login only; afterwards it is changed in the app and never overwritten by the IdP.
- A blocked or deleted user gets no session; an existing session ends with the next request.

## 8.14 Bootstrapping the first system administrator

The deployment configuration lists identities that are system administrators from the start (`Bootstrap__SystemAdministrators`, entries `issuer|subject`). When such an identity logs in and **no active system administrator exists yet**, or the identity logs in for the very first time, it gets the role. Afterwards the role is managed only in the app, so revoking it there sticks. If every system administrator is gone (e.g. deleted directly in the database), a configured identity gets the role again on its next login — the recovery path.

## 8.15 Saving situations on the server (Phase 2)

- **Areas:** a situation lives in exactly one area (a user's personal area or a team) and optionally in one folder of that area. It can be moved between the folders (and the top level) of its area, but not moved or copied to another area (only via JSON export/import).
- **Folders:** flat, names unique within the area (ignoring upper/lower case), deletable only when empty.
- **Save:** explicit, with the Save button or Ctrl+S / Cmd+S (no autosave). The first save of a new or imported situation creates it **where it was started**: the area and folder (or top level) from which "New situation" or "Import" was chosen; from the start page, the top level of the personal area (without login: no server save, only export). Later saves update it.
- **Storage:** see ADR-009. Each save writes a new revision; the situation row carries the metadata (title, field type, created/updated at and by, current revision).
- **Titles:** unique among the non-deleted situations of an area, compared after trimming and ignoring upper/lower case. Saving with a title that exists there fails (Problem Details, the editor shows the error). When an imported situation is saved for the first time and its title exists, it gets the suffix " (2)" (or the next free number). Default titles are incremented within the area: "Untitled Situation", "Untitled Situation (2)", …
- **Conflicts:** optimistic concurrency with the revision number (`ETag` / `If-Match`). If someone else saved in between, the save fails with `412`, and the user chooses **Overwrite** (save again on top of the newest revision), **Save as copy** (a new situation with title suffix " (2)" or the next free number) or **Cancel**.
- **Shown metadata:** created by/at and last changed by/at.
- **Format:** the server always stores the current file format version; the frontend migrates older files on import (ch. 8.3) and the backend validates the document before saving.

## 8.16 Soft delete

- Situations, folders, teams, memberships, join requests and users are never deleted physically: they get a `deletedAt` timestamp and disappear from all queries. There is no restore UI and no final purge yet.
- Deleting a team soft-deletes its folders, situations, memberships and pending join requests. A folder can be deleted only while it contains no (non-deleted) situations.
- Uniqueness (situation titles and folder names per area, team names) only counts non-deleted items, so names can be reused.
- **Account deletion** (by the user or a system administrator): blocked while the user is the last Admin of a team with other members. Otherwise their personal area (folders, situations), memberships and pending join requests are soft-deleted, teams where they were the only member are deleted, and the user record is anonymized (display name removed) and soft-deleted. "Created/changed by" on team situations then shows "Deleted user".

## 8.17 Teams (Phase 2)

- **Name:** unique among non-deleted teams, compared after trimming and ignoring upper/lower case. **Logo:** optional; PNG, JPEG or WebP; the backend scales it down to fit 256 × 256 px, re-encodes it (dropping metadata) and stores it in the database.
- **Code:** 6 characters from A–Z and 0–9, generated randomly when the team is created (retried on a collision), never changed. The team link contains the code.
- **Overview:** only for logged-in users; lists all teams with name and logo, searchable by name or code.
- **Join requests:** one pending request per user and team; it can't be withdrawn; after a rejection the user may send a new one. Joining through a link also creates a request.
