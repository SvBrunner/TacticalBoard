# Known limitations

## The board page cannot be server-rendered

The board (`frontend/src/routes/+page.svelte`) draws its content with Konva canvases. Konva requires a browser (canvas/DOM APIs) and cannot run in a server-side rendering context.

Because of this, `frontend/src/routes/+page.ts` sets `ssr = false` for the board route: the page is rendered entirely client-side and cannot be prerendered as static HTML.

**Impact:**
- No server-rendered HTML for the board page — search engines and no-JS clients see an empty shell.
- First paint waits for JS to load and run.
