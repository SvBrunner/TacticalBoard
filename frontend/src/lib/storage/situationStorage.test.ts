import { describe, it, expect, afterEach, vi } from "vitest";
import { situationEditor } from "$lib/editor/SituationEditor";
import { FakeFetch, jsonResponse } from "$lib/testing/fakeFetch";
import { storedFrom } from "$lib/testing/storageFakes";
import { situationLink } from "./SituationLink";
import { situationOpener } from "./situationStorage";

describe("situationStorage", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		situationEditor.close();
		situationLink.reset();
	});

	it("opens a saved situation from the server into the app's editor and link", async () => {
		situationEditor.createNew({ title: "Source", fieldType: "half" });
		const stored = storedFrom(situationEditor.current(), { id: "server-9", title: "Source", revision: 4 });
		situationEditor.close();
		vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/situations/server-9", jsonResponse(200, stored)).fetch);

		await expect(situationOpener.open("server-9")).resolves.toMatchObject({ status: "opened" });

		expect(situationEditor.current()).toMatchObject({ id: "server-9", fieldType: "half" });
		expect(situationLink.saved()?.revision).toBe(4);
	});
});
