import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// svelte-konva 1.x components take flat props (x, y, fill, ...), not a
// wrapped `config={{...}}` object like the pre-upgrade 0.3.x API did.
// Passing `config={{...}}` silently sets a single meaningless "config"
// attribute on the underlying Konva node instead of the intended ones
// (width/height/fill/name/...), so nothing renders and hit-testing
// (target.attrs.name, etc.) never matches — with no build or type error
// and no console output, since it's valid TS/Svelte, just the wrong API
// shape. This test scans for that pattern regressing.
function collectSvelteFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			files.push(...collectSvelteFiles(full));
		} else if (entry.endsWith(".svelte")) {
			files.push(full);
		}
	}
	return files;
}

describe("svelte-konva components use flat props, not config={{...}}", () => {
	const root = process.cwd();
	const files = [
		...collectSvelteFiles(join(root, "src/lib/components/board")),
		...collectSvelteFiles(join(root, "src/routes")),
	];

	it.each(files.map((f) => [f.replace(root, ""), f]))("%s has no config={{ konva prop", (_label, file) => {
		const content = readFileSync(file, "utf-8");
		expect(content).not.toMatch(/config=\{\{/);
	});
});

// svelte-konva 1.x's Shape/component wrappers give `scale`, `scaleX` and
// `scaleY` each their own independent $effect that calls
// `node.setAttr(...)`. If a component passes `scale={{x, y}}` but not
// `scaleX`/`scaleY`, those two effects still run (with the local,
// undefined prop values) and Konva's setAttr treats `undefined` as
// "delete this attr" — silently erasing the scale the `scale` effect
// just set, with no build/type/console error. Passing flat `scaleX`/
// `scaleY` props instead avoids the conflicting effects entirely. This
// test scans for that pattern regressing (caught a real mirroring bug
// in Goal.svelte where `mirrored` had no visible effect).
describe("svelte-konva components use flat scaleX/scaleY props, not scale={{...}}", () => {
	const root = process.cwd();
	const files = [
		...collectSvelteFiles(join(root, "src/lib/components/board")),
		...collectSvelteFiles(join(root, "src/routes")),
	];

	it.each(files.map((f) => [f.replace(root, ""), f]))("%s has no scale={{ konva prop", (_label, file) => {
		const content = readFileSync(file, "utf-8");
		expect(content).not.toMatch(/\sscale=\{\{/);
	});
});

// svelte-konva 1.x components read event hooks as plain props named
// `on<event>` (e.g. `onclick`, `ondragend`), not Svelte's `on:event`
// directive — they don't use createEventDispatcher internally, so an
// `on:click={...}` on a Konva component (as opposed to a native HTML
// element) is listening for an event that's never dispatched and silently
// never fires. The payload konva passes is also the raw Konva event
// (`{ target, evt }`), not a CustomEvent, so handlers must read
// `e.target`/`e.evt` directly rather than `e.detail.target`/`e.detail.evt`.
const KONVA_COMPONENTS = [
	"Stage",
	"Layer",
	"Group",
	"Shape",
	"Rect",
	"Circle",
	"Line",
	"Arc",
	"Arrow",
	"Ellipse",
	"Image",
	"Label",
	"Path",
	"RegularPolygon",
	"Ring",
	"Sprite",
	"Star",
	"Text",
	"TextPath",
	"Transformer",
	"Wedge",
	"Tag",
];

describe("svelte-konva components use on<event> props, not on:event directives", () => {
	const root = process.cwd();
	const files = [
		...collectSvelteFiles(join(root, "src/lib/components/board")),
		...collectSvelteFiles(join(root, "src/routes")),
	];
	const tagPattern = new RegExp(`<(${KONVA_COMPONENTS.join("|")})\\b[\\s\\S]*?(?:/>|>)`, "g");

	it.each(files.map((f) => [f.replace(root, ""), f]))("%s has no on: directive on a Konva component", (_label, file) => {
		const content = readFileSync(file, "utf-8");
		const tags = content.match(tagPattern) ?? [];
		for (const tag of tags) {
			expect(tag).not.toMatch(/\son:[a-z]+=/);
		}
	});
});
