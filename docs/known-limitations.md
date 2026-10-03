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

## Little room for the field on landscape phones with the details panel open

On phones the details panel (title, descriptions) is a collapsible bar above the board. Opened on a phone in landscape orientation, it takes up to about half of the already small height, so the field becomes very small until the panel is collapsed again. Portrait phones and larger screens are much less affected.

## Editing arrows on small screens

On phones the edit popover is a bottom sheet. On a landscape phone (and partly on a portrait phone) it covers the board, including the handles of the selected arrow. The arrow popover therefore has an **Edit shape** button that hides the popover but keeps the arrow selected, so its handles can be dragged; tapping a bend brings the popover back (for "Remove bend").

On a small board (e.g. a half field on a landscape phone, about 220 CSS px) the 44 CSS px hit circles of an arrow's handles overlap on short segments. Where they do, the start, end and bend handles win over the "+" (add bend) handles, so a bend can then only be added on a longer segment, or after turning the phone or using a larger screen.

## GIF export: sharing and performance

**Share** in the GIF export dialog appears only where the browser can share files (`navigator.canShare({ files })`): typically Safari and Chrome on phones and tablets, some desktop browsers (e.g. Safari on macOS, Chrome on Windows) too, but not Firefox on the desktop. Elsewhere only **Download** is offered. The decision is pure feature detection, not "is this a phone".

The GIF is rendered and encoded in the browser's main thread, one frame at a time. Between frames the page stays responsive (progress, Cancel), but a single frame blocks it briefly — longer at the Large resolution and on slow phones. Memory grows with frames × resolution (each Large frame is 1800 px wide). Situations with many frames at Large therefore take noticeably longer and produce large files; nothing caps the frame count.

GIF stores frame delays in hundredths of a second and at most 256 colors per frame; antialiased edges are slightly quantized.

