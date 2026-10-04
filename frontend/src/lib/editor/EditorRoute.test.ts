import { describe, it, expect } from "vitest";
import { EditorRoute } from "./EditorRoute";

describe("EditorRoute", () => {
	it("names a saved situation in the query", () => {
		expect(EditorRoute.forSaved("s1")).toBe("/editor?situation=s1");
		expect(EditorRoute.forSaved("a b/c")).toBe("/editor?situation=a%20b%2Fc");
	});

	it("reads the saved situation back from a URL", () => {
		expect(EditorRoute.savedIdIn(new URL("http://x" + EditorRoute.forSaved("a b/c")))).toBe("a b/c");
		expect(EditorRoute.savedIdIn(new URL("http://x/editor"))).toBeNull();
		expect(EditorRoute.savedIdIn(new URL("http://x/editor?situation="))).toBeNull();
	});
});
