# Known limitations

## The board page cannot be server-rendered

The board (`frontend/src/routes/+page.svelte`) draws its content with Konva canvases. Konva requires a browser (canvas/DOM APIs) and cannot run in a server-side rendering context.

Because of this, `frontend/src/routes/+page.ts` sets `ssr = false` for the board route: the page is rendered entirely client-side and cannot be prerendered as static HTML.

**Impact:**
- No server-rendered HTML for the board page — search engines and no-JS clients see an empty shell.
- First paint waits for JS to load and run.

## No pinch-zoom on the board

The field is always scaled to fit the available space and cannot be zoomed or panned. The board area disables the browser's own touch gestures (`touch-action: none`), so a pinch neither zooms the page nor the board. This is a deliberate MVP decision.

**Impact:**
- On a phone in portrait orientation the field is never rotated, so it is drawn small (about the screen width × half of it), and so are the elements, since they keep their proportions to the field.
- Elements get an enlarged invisible hit area of at least 44 CSS px, so they stay easy to tap and drag. Where hit areas of close elements overlap, the topmost element wins, and a tap near an element selects it instead of placing a new one.
- Users who need more detail can turn the phone to landscape or use a tablet/desktop.
