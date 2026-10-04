import { describe, it, expect } from "vitest";
import * as layoutOptions from "./+layout";

describe("root layout options", () => {
	it("renders every route in the browser only (static SPA build)", () => {
		expect(layoutOptions.ssr).toBe(false);
	});

	it("does not prerender any route (the fallback page serves them all)", () => {
		expect("prerender" in layoutOptions).toBe(false);
	});
});
