import { describe, it, expect, beforeEach } from "vitest";
import { isRedirect } from "@sveltejs/kit";
import { situationEditor } from "$lib/editor/SituationEditor";
import { load, ssr } from "./+page";

type LoadEvent = Parameters<typeof load>[0];

function callLoad(): unknown {
	try {
		load({} as LoadEvent);
		return undefined;
	} catch (thrown) {
		return thrown;
	}
}

describe("editor route", () => {
	it("is rendered in the browser only (Konva)", () => {
		expect(ssr).toBe(false);
	});

	describe("without an open situation", () => {
		it("redirects to the start page", () => {
			expect(situationEditor.isSituationOpen()).toBe(false);

			const thrown = callLoad();

			expect(isRedirect(thrown)).toBe(true);
			expect(thrown).toMatchObject({ status: 307, location: "/" });
		});
	});

	describe("with an open situation", () => {
		beforeEach(() => {
			situationEditor.createNew({ title: "", fieldType: "full" });
		});

		it("opens the editor", () => {
			expect(callLoad()).toBeUndefined();
		});
	});
});
