import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { SituationEditor } from "$lib/editor/SituationEditor";
import { FixedClock } from "$lib/model/Clock";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { Frame } from "$lib/model/Frame";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { storedFrom } from "$lib/testing/storageFakes";
import type { StoredSituation } from "./SituationApi";
import { SituationLink } from "./SituationLink";
import { SituationOpener } from "./SituationOpener";

const onServer = new Situation({
	id: "local",
	title: "Breakout",
	description: "From the server",
	sport: "floorball",
	fieldType: "half",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	frames: [new Frame("f1", "", [])],
});

describe("SituationOpener", () => {
	let editor: SituationEditor;
	let link: SituationLink;
	let answer: StoredSituation | Error;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let opener: SituationOpener;

	beforeEach(() => {
		editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock());
		link = new SituationLink();
		answer = storedFrom(onServer, { id: "server-7", title: "Breakout", revision: 3 });
		log = { notify: vi.fn() };
		opener = new SituationOpener({
			editor,
			link,
			api: {
				get: async () => {
					if (answer instanceof Error) {
						throw answer;
					}
					return answer;
				},
			},
			serializer: new SituationSerializer(),
			log,
		});
	});

	it("loads the saved situation into the editor and links it", async () => {
		const outcome = await opener.open("server-7");

		expect(outcome.status).toBe("opened");
		expect(editor.isSituationOpen()).toBe(true);
		expect(editor.current()).toMatchObject({ id: "server-7", title: "Breakout", fieldType: "half", description: "From the server" });
		expect(editor.isDirty()).toBe(false);
		expect(link.saved()).toMatchObject({ id: "server-7", revision: 3 });
		expect(link.saved()).not.toHaveProperty("document");
	});

	it("asks to discard changes only after loading, and keeps everything when cancelled", async () => {
		editor.createNew({ title: "Mine", fieldType: "full" });
		const before = editor.current();
		const confirm = vi.fn(async () => false);

		await expect(opener.open("server-7", confirm)).resolves.toEqual({ status: "cancelled" });

		expect(confirm).toHaveBeenCalledOnce();
		expect(editor.current()).toBe(before);
		expect(link.saved()).toBeNull();
	});

	it.each<[string, Error | StoredSituation, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["a deleted situation", new ApiError(404, {}), "This situation no longer exists."],
		["another error", new ApiError(500, {}), "The situation couldn't be opened."],
		["an unreadable document", { ...storedFrom(onServer), document: { format: "nope" } }, "The saved situation can't be read by this version of the app."],
	])("reports %s without asking or changing anything", async (_name, result, message) => {
		answer = result;
		const confirm = vi.fn(async () => true);

		await expect(opener.open("server-7", confirm)).resolves.toEqual({ status: "failed", message });

		expect(confirm).not.toHaveBeenCalled();
		expect(editor.isSituationOpen()).toBe(false);
		expect(log.notify).toHaveBeenLastCalledWith(expect.stringContaining(message), "error");
	});

	it("works without a log", async () => {
		const quiet = new SituationOpener({ editor, link, api: { get: async () => storedFrom(onServer) }, serializer: new SituationSerializer() });

		await expect(quiet.open("x")).resolves.toMatchObject({ status: "opened" });
	});
});
