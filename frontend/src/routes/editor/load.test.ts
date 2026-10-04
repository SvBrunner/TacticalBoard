import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isRedirect } from "@sveltejs/kit";
import { situationEditor } from "$lib/editor/SituationEditor";
import { situationLink } from "$lib/storage/SituationLink";
import { FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { storedFrom } from "$lib/testing/storageFakes";
import { load, ssr } from "./+page";

type LoadEvent = Parameters<typeof load>[0];

async function callLoad(url = "http://localhost/editor"): Promise<unknown> {
	try {
		await load({ url: new URL(url) } as LoadEvent);
		return undefined;
	} catch (thrown) {
		return thrown;
	}
}

describe("editor route", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		situationEditor.close();
		situationLink.reset();
	});

	it("is rendered in the browser only (Konva)", () => {
		expect(ssr).toBe(false);
	});

	describe("without an open situation", () => {
		beforeEach(() => {
			situationEditor.close();
		});

		it("redirects to the start page", async () => {
			expect(situationEditor.isSituationOpen()).toBe(false);

			const thrown = await callLoad();

			expect(isRedirect(thrown)).toBe(true);
			expect(thrown).toMatchObject({ status: 307, location: "/" });
		});

		it("restores the saved situation named in the URL (e.g. after a reload)", async () => {
			situationEditor.createNew({ title: "Saved", fieldType: "half" });
			const stored = storedFrom(situationEditor.current(), { id: "s1", title: "Saved" });
			situationEditor.close();
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/situations/s1", jsonResponse(200, stored)).fetch);

			expect(await callLoad("http://localhost/editor?situation=s1")).toBeUndefined();

			expect(situationEditor.isSituationOpen()).toBe(true);
			expect(situationEditor.current()).toMatchObject({ id: "s1", title: "Saved", fieldType: "half" });
			expect(situationLink.saved()?.id).toBe("s1");
		});

		it.each([
			["not logged in", problemResponse(401, {})],
			["deleted", problemResponse(404, {})],
			["no server", new Response("proxy error", { status: 502 })],
		])("redirects to the start page when the saved situation can't be loaded (%s)", async (_name, response) => {
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/situations/s1", response).fetch);

			const thrown = await callLoad("http://localhost/editor?situation=s1");

			expect(thrown).toMatchObject({ status: 307, location: "/" });
			expect(situationEditor.isSituationOpen()).toBe(false);
		});
	});

	describe("with an open situation", () => {
		beforeEach(() => {
			situationEditor.createNew({ title: "", fieldType: "full" });
		});

		it("opens the editor without asking the server", async () => {
			const fetch = vi.fn();
			vi.stubGlobal("fetch", fetch);

			expect(await callLoad("http://localhost/editor?situation=s1")).toBeUndefined();
			expect(fetch).not.toHaveBeenCalled();
		});
	});
});
