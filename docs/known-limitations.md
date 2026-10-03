# Known limitations

## The board page cannot be server-rendered

The board editor (`frontend/src/routes/editor/+page.svelte`) draws its content with Konva canvases. Konva requires a browser (canvas/DOM APIs) and cannot run in a server-side rendering context.

Because of this, `frontend/src/routes/editor/+page.ts` sets `ssr = false` for the editor route: the page is rendered entirely client-side and cannot be prerendered as static HTML. (The start page `/` does not use Konva and is server-rendered normally.)

**Impact:**
- No server-rendered HTML for the board page — search engines and no-JS clients see an empty shell.
- First paint waits for JS to load and run.

## No pinch-zoom on the board

The field is always scaled to fit the available space and cannot be zoomed or panned. The board area disables the browser's own touch gestures (`touch-action: none`), so a pinch neither zooms the page nor the board. This is a deliberate MVP decision.

**Impact:**
- On a phone in portrait orientation the full field is never rotated, so it is drawn small (about the screen width × half of it), and so are the elements, since they keep their proportions to the field. (Half-field situations are shown in portrait and use the space better.)
- Elements get an enlarged invisible hit area of at least 44 CSS px, so they stay easy to tap and drag. Where hit areas of close elements overlap, the topmost element wins, and a tap near an element selects it instead of placing a new one.
- Users who need more detail can turn the phone to landscape or use a tablet/desktop.

## The edited situation lives in memory only

Until there is storage (Phase 2), the situation being edited exists only in the browser tab's memory. Reloading the page or opening `/editor` directly therefore has no situation to show and leads back to the start page. While there are unsaved (not exported) changes, the browser warns before the page is left or reloaded.

## Hidden-half elements of half-field situations

A half-field situation shows only one half of the field (see [ch. 8](arc42/08_crosscutting_concepts.md)). Elements from an imported file that lie in the other half stay in the data but are not visible and cannot be reached. An element right at the center line can be partly visible; its enlarged hit area can reach into the visible half.
