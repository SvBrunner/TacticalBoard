import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { goto } from "$app/navigation";
import { authSession } from "$lib/auth/AuthSession";
import { situationEditor } from "$lib/editor/SituationEditor";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { inFolder, teamTopLevel, TOP_LEVEL } from "$lib/storage/SaveTarget";
import { SituationApi, type SituationSummary } from "$lib/storage/SituationApi";
import { situationLink } from "$lib/storage/SituationLink";
import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse, type RecordedRequest } from "$lib/testing/fakeFetch";
import { summaryOf } from "$lib/testing/storageFakes";
import EditorPage from "./+page.svelte";
import { i18n } from "$lib/i18n";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => undefined) }));

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

/** What the backend answers to a save: the sent document with the server-owned values stamped in. */
function echo(request: RecordedRequest, status: number, overrides: Partial<SituationSummary> = {}): Response {
	const { document } = JSON.parse(request.body!) as { document: { situation: Record<string, unknown> } };
	const summary = summaryOf({
		title: String(document.situation.title).trim(),
		fieldType: String(document.situation.fieldType),
		createdBy: { id: "u1", displayName: "Alice" },
		updatedBy: { id: "u1", displayName: "Alice" },
		...overrides,
	});
	return jsonResponse(status, {
		...summary,
		document: {
			...document,
			situation: { ...document.situation, id: summary.id, title: summary.title, createdAt: summary.createdAt, updatedAt: summary.updatedAt },
		},
	});
}

describe("editor page: saving on the server", () => {
	let restoreDialog: () => void;
	let restoreCanvas: () => void;
	let server: FakeFetch;

	async function logIn() {
		server.on("GET", "/api/me", jsonResponse(200, { id: "u1", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null }));
		await authSession.refresh();
	}

	const saveButton = () => screen.getByRole("button", { name: "Save" });
	const posts = () => server.requestsTo(SituationApi.PERSONAL_AREA_PATH).filter((request) => request.method === "POST");

	beforeEach(() => {
		restoreDialog = installDialogPolyfill();
		restoreCanvas = installFakeCanvasContext();
		FakeResizeObserver.reset();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
		vi.mocked(goto).mockClear();
		server = new FakeFetch()
			.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY))
			.on("POST", SituationApi.PERSONAL_AREA_PATH, (request) => echo(request, 201, { id: "s1", revision: 1 }));
		vi.stubGlobal("fetch", server.fetch);
		situationEditor.createNew({ title: "Breakout", fieldType: "full" });
		situationLink.startNew();
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		restoreCanvas();
		restoreDialog();
		situationLink.reset();
	});

	describe("not logged in", () => {
		beforeEach(async () => {
			server.on("GET", "/api/me", problemResponse(401, {}));
			await authSession.refresh();
		});

		it("offers no Save button", () => {
			render(EditorPage);

			expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
		});

		it("leaves Ctrl+S to the browser", async () => {
			render(EditorPage);

			const notPrevented = await fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });

			expect(notPrevented).toBe(true);
			expect(posts()).toHaveLength(0);
		});
	});

	describe("logged in", () => {
		beforeEach(logIn);

		it("has the account menu in the shared navbar", () => {
			render(EditorPage);

			const account = within(screen.getByRole("banner")).getByRole("navigation", { name: "Account" });
			expect(within(account).getByRole("button", { name: "Alice" })).toBeInTheDocument();
		});

		it("a login from the editor of a saved situation returns to it", async () => {
			situationLink.attach(summaryOf({ id: "s1" }));
			server.on("GET", "/api/me", problemResponse(401, {}));
			await authSession.refresh();
			render(EditorPage);

			expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/auth/login?returnUrl=%2Feditor%3Fsituation%3Ds1");
		});

		it("the first save creates the situation and shows the server's state", async () => {
			situationEditor.addElement(100, 100, "red", "Player");
			render(EditorPage);

			await fireEvent.click(saveButton());
			await settle();

			expect(JSON.parse(posts()[0].body!)).toMatchObject({ origin: "new", document: { situation: { title: "Breakout" } } });
			expect(situationEditor.current().id).toBe("s1");
			expect(situationEditor.isDirty()).toBe(false);
			expect(goto).toHaveBeenCalledWith("/editor?situation=s1", { replaceState: true, keepFocus: true, noScroll: true });
		});

		it("an imported situation is saved as imported", async () => {
			situationLink.startImported();
			render(EditorPage);

			await fireEvent.click(saveButton());
			await settle();

			expect(JSON.parse(posts()[0].body!).origin).toBe("imported");
		});

		it("shows who created and changed a saved situation in the details panel", async () => {
			render(EditorPage);

			await fireEvent.click(saveButton());
			await settle();

			const info = within(screen.getByRole("complementary", { name: "Details" })).getAllByRole("definition");
			expect(info[0]).toHaveTextContent(`by Alice, ${SavedSituationFormat.dateTime("2026-10-04T08:00:00.000Z", "en")}`);
			expect(info[1]).toHaveTextContent("by Alice,");
		});

		it("Ctrl+S saves, also from a text field, and prevents the browser's Save page", async () => {
			render(EditorPage);

			const notPrevented = await fireEvent.keyDown(screen.getByRole("textbox", { name: "Title" }), { key: "s", ctrlKey: true });
			await settle();

			expect(notPrevented).toBe(false);
			expect(posts()).toHaveLength(1);
		});

		it("Cmd+S saves too", async () => {
			render(EditorPage);

			await fireEvent.keyDown(document.body, { key: "s", metaKey: true });
			await settle();

			expect(posts()).toHaveLength(1);
		});

		it("a later save updates with If-Match of the known revision", async () => {
			server.on("PUT", "/api/situations/s1", (request) => echo(request, 200, { id: "s1", revision: 2 }));
			render(EditorPage);
			await fireEvent.click(saveButton());
			await settle();
			situationEditor.addElement(5, 5, "red", "Player");

			await fireEvent.click(saveButton());
			await settle();

			const [update] = server.requestsTo("/api/situations/s1");
			expect(update.method).toBe("PUT");
			expect(update.headers["If-Match"]).toBe('"1"');
			expect(situationLink.saved()?.revision).toBe(2);
			expect(situationEditor.isDirty()).toBe(false);
		});

		it("shows a taken title as an error in the editor", async () => {
			server.on("POST", SituationApi.PERSONAL_AREA_PATH, problemResponse(409, { type: SituationApi.DUPLICATE_TITLE }));
			situationEditor.addElement(5, 5, "red", "Player");
			render(EditorPage);

			await fireEvent.click(saveButton());
			await settle();

			const alert = within(screen.getByRole("banner")).getByRole("alert");
			expect(alert).toHaveTextContent("A situation titled “Breakout” already exists. Choose another title and save again.");
			expect(situationEditor.isDirty()).toBe(true);

			await fireEvent.click(within(alert).getByRole("button", { name: "Dismiss" }));
			expect(screen.queryByRole("alert")).toBeNull();
		});

		describe("when someone else saved in the meantime", () => {
			beforeEach(async () => {
				situationLink.attach(summaryOf({ id: "s1", revision: 1, title: "Breakout" }));
				situationEditor.addElement(7, 7, "red", "Player");
				server.on("PUT", "/api/situations/s1", (request) =>
					request.headers["If-Match"] === '"1"'
						? problemResponse(412, { type: SituationApi.SAVE_CONFLICT, currentRevision: 4 })
						: echo(request, 200, { id: "s1", revision: 5 }),
				);
			});

			async function saveIntoConflict() {
				render(EditorPage);
				await fireEvent.click(saveButton());
				await settle();
				return screen.getByRole("alertdialog", { name: "Saved by someone else" });
			}

			it("Overwrite saves on top of the newest revision", async () => {
				const dialog = await saveIntoConflict();

				await fireEvent.click(within(dialog).getByRole("button", { name: "Overwrite" }));
				await settle();

				expect(server.requestsTo("/api/situations/s1").map((request) => request.headers["If-Match"])).toEqual(['"1"', '"4"']);
				expect(situationLink.saved()?.revision).toBe(5);
				expect(dialog).not.toHaveAttribute("open");
			});

			it("Save as copy creates a new situation and continues with it", async () => {
				server.on("POST", SituationApi.PERSONAL_AREA_PATH, (request) => echo(request, 201, { id: "s2", title: "Breakout (2)" }));
				const dialog = await saveIntoConflict();

				await fireEvent.click(within(dialog).getByRole("button", { name: "Save as copy" }));
				await settle();

				expect(JSON.parse(posts()[0].body!).origin).toBe("copy");
				expect(situationEditor.current()).toMatchObject({ id: "s2", title: "Breakout (2)" });
				expect(goto).toHaveBeenCalledWith("/editor?situation=s2", expect.anything());
			});

			it("Cancel keeps the situation unsaved", async () => {
				situationEditor.addElement(5, 5, "red", "Player");
				const dialog = await saveIntoConflict();

				await fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
				await settle();

				expect(server.requestsTo("/api/situations/s1")).toHaveLength(1);
				expect(situationEditor.isDirty()).toBe(true);
			});
		});

		it("disables Save while saving", async () => {
			let release: (response: Response) => void = () => undefined;
			server.on("POST", SituationApi.PERSONAL_AREA_PATH, () => new Promise<Response>((resolve) => (release = resolve)));
			render(EditorPage);

			await fireEvent.click(saveButton());
			await settle();

			expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
			release(problemResponse(500, {}));
			await settle();
			expect(saveButton()).toBeEnabled();
		});

		it("exporting a saved situation doesn't count as saving it", async () => {
			situationLink.attach(summaryOf({ id: "s1" }));
			situationEditor.addElement(5, 5, "red", "Player");
			vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined }));
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "Export" }));
			await fireEvent.click(screen.getByRole("button", { name: "Situation file (JSON)" }));

			expect(situationEditor.isDirty()).toBe(true);
		});

		it("exporting a new, never-saved situation doesn't count as saving it either (logged in)", async () => {
			situationEditor.addElement(5, 5, "red", "Player");
			vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined }));
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "Export" }));
			await fireEvent.click(screen.getByRole("button", { name: "Situation file (JSON)" }));

			expect(situationEditor.isDirty()).toBe(true);
			expect(saveButton()).toBeEnabled();
		});

		it("a never-saved situation can be saved without edits", () => {
			render(EditorPage);

			expect(situationEditor.isDirty()).toBe(false);
			expect(saveButton()).toBeEnabled();
		});

		it("Save is disabled without unsaved changes; Ctrl+S then only keeps the browser's dialog away", async () => {
			render(EditorPage);
			await fireEvent.click(saveButton());
			await settle();

			expect(saveButton()).toBeDisabled();
			expect(saveButton()).toHaveAttribute("title", "Save (no unsaved changes)");
			const notPrevented = await fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
			await settle();
			expect(notPrevented).toBe(false);
			expect(posts()).toHaveLength(1);
			expect(server.requestsTo("/api/situations/s1")).toHaveLength(0);

			situationEditor.addElement(5, 5, "red", "Player");
			await tick();
			expect(saveButton()).toBeEnabled();
		});

		it("asks the server to number a default title of any language", async () => {
			situationEditor.createNew({ title: "Unbenannte Situation", fieldType: "full" });
			situationLink.startNew();
			render(EditorPage);

			await fireEvent.click(saveButton());
			await settle();

			expect(JSON.parse(posts()[0].body!)).toMatchObject({ origin: "new", titleIsDefault: true });
		});

		it("is German in German: tools, and a server error worded from its code", async () => {
			i18n.select("de");
			server.on(
				"POST",
				SituationApi.PERSONAL_AREA_PATH,
				problemResponse(400, { type: "https://tacticalboard/errors/field-type-changed", detail: "English detail." }),
			);
			render(EditorPage);

			expect(screen.getByRole("button", { name: "Rückgängig" })).toBeInTheDocument();
			expect(screen.getByRole("group", { name: "Verlauf" })).toBeInTheDocument();
			expect(screen.getByRole("complementary", { name: "Werkzeuge" })).toBeInTheDocument();
			expect(screen.getByRole("region", { name: "Wiedergabe" })).toBeInTheDocument();
			expect(screen.getByRole("navigation", { name: "Bilder" })).toBeInTheDocument();
			expect(screen.getByRole("textbox", { name: "Titel" })).toBeInTheDocument();
			expect(document.title).toBe("Breakout · Tactical Board");

			await fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
			await settle();

			const alert = within(screen.getByRole("banner")).getByRole("alert");
			expect(alert).toHaveTextContent(
				"Die Situation konnte nicht gespeichert werden: Das Spielfeld einer Situation kann nicht geändert werden.",
			);
			expect(alert).not.toHaveTextContent("English detail.");
		});

		it("shows a blank title as the default title of the UI language", async () => {
			situationEditor.changeTitle("  ");
			i18n.select("de");
			render(EditorPage);

			expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).toHaveTextContent("Unbenannte Situation");
			expect(screen.getByRole("textbox", { name: "Titel" })).toHaveAttribute("placeholder", "Unbenannte Situation");
		});

		it("starting a new situation drops the saved situation from the URL", async () => {
			situationLink.attach(summaryOf({ id: "s1" }));
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));
			await settle();

			expect(goto).toHaveBeenCalledWith("/editor", { replaceState: true, keepFocus: true, noScroll: true });
			expect(situationLink.saved()).toBeNull();
		});
	});

	describe("the folder of the edited situation", () => {
		const badge = (name: string) => within(screen.getByRole("banner")).getByRole("link", { name });

		async function newSituation() {
			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));
			await settle();
		}

		async function loadFile() {
			const file = new File([new SituationSerializer().serialize(situationEditor.current().withTitle("Imported"))], "x.situation.json");
			const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
			Object.defineProperty(input, "files", { value: [file], configurable: true });
			await fireEvent.change(input);
			await settle();
		}

		describe("logged in", () => {
			beforeEach(logIn);

			it("New saves into the folder of the edited server situation", async () => {
				server.on("POST", "/api/folders/f1/situations", (request) => echo(request, 201, { id: "s2", folderId: "f1" }));
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1" }));
				render(EditorPage);

				await newSituation();
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: { area: { kind: "personal" }, folderId: "f1" } });
				await fireEvent.click(saveButton());
				await settle();

				expect(server.requestsTo("/api/folders/f1/situations").map((request) => request.method)).toEqual(["POST"]);
				expect(posts()).toHaveLength(0);
			});

			it("Load (import) saves into the folder of the edited server situation", async () => {
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1" }));
				render(EditorPage);

				await loadFile();

				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "imported", target: { area: { kind: "personal" }, folderId: "f1" } });
			});

			it("New and Load stay in the folder an unsaved situation was started in", async () => {
				situationLink.startNew(inFolder("f2"));
				render(EditorPage);

				await newSituation();
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: { area: { kind: "personal" }, folderId: "f2" } });
				await loadFile();
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "imported", target: { area: { kind: "personal" }, folderId: "f2" } });
			});

			it("New and Load save at the top level for a situation in no folder", async () => {
				situationLink.attach(summaryOf({ id: "s1", folderId: null }));
				render(EditorPage);

				await newSituation();
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
				await loadFile();
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "imported", target: TOP_LEVEL });
			});

			it("the badge leads back to the folder's page while the situation is in a folder, and follows a move", async () => {
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1" }));
				render(EditorPage);

				expect(badge("Back to the folder")).toHaveAttribute("href", "/folders/f1");
				situationLink.relocate("s1", null);
				await settle();
				expect(badge("Start page")).toHaveAttribute("href", "/");
			});

			it("the badge goes to the folder's page and closes the situation", async () => {
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1" }));
				render(EditorPage);

				await fireEvent.click(badge("Back to the folder"));
				await settle();

				expect(goto).toHaveBeenCalledWith("/folders/f1");
				expect(situationEditor.isSituationOpen()).toBe(false);
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
			});

			it("the badge asks 'Discard changes?' first, as for the start page; Cancel stays", async () => {
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1" }));
				situationEditor.addElement(1, 1, "red", "Player");
				render(EditorPage);

				await fireEvent.click(badge("Back to the folder"));
				await settle();
				expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
				await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
				await settle();
				expect(goto).not.toHaveBeenCalled();

				await fireEvent.click(badge("Back to the folder"));
				await settle();
				await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
				await settle();
				expect(goto).toHaveBeenCalledWith("/folders/f1");
			});

			it("the badge leads back to the folder an unsaved situation was started in", () => {
				situationLink.startImported(inFolder("f2"));
				render(EditorPage);

				expect(badge("Back to the folder")).toHaveAttribute("href", "/folders/f2");
			});

			it("names the badge in German", async () => {
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1" }));
				i18n.select("de");
				render(EditorPage);

				expect(badge("Zurück zum Ordner")).toHaveAttribute("href", "/folders/f1");
				i18n.select("en");
			});
		});

		describe("not logged in (local mode)", () => {
			beforeEach(async () => {
				server.on("GET", "/api/me", problemResponse(401, {}));
				await authSession.refresh();
			});

			it("the badge leads to the start page and New starts at the top level, whatever the link says", async () => {
				situationLink.startNew(inFolder("f2"));
				render(EditorPage);

				expect(badge("Start page")).toHaveAttribute("href", "/");
				await newSituation();
				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
			});
		});
	});

	describe("a team situation", () => {
		const team = { kind: "team" as const, id: "t1" };
		const badge = (name: string) => within(screen.getByRole("banner")).getByRole("link", { name });

		beforeEach(logIn);

		it("saves a situation started at a team's top level there, and the badge leads back to the team", async () => {
			server.on("POST", "/api/teams/t1/situations", (request) => echo(request, 201, { id: "s1", area: team }));
			situationLink.startNew(teamTopLevel("t1"));
			render(EditorPage);

			expect(badge("Back to the team")).toHaveAttribute("href", "/teams/t1");
			await fireEvent.click(saveButton());
			await settle();

			expect(server.requestsTo("/api/teams/t1/situations").map((request) => request.method)).toEqual(["POST"]);
			expect(posts()).toHaveLength(0);
			expect(situationLink.saved()?.area).toEqual(team);
		});

		it("New in the editor of a team situation saves into the team too", async () => {
			situationLink.attach(summaryOf({ id: "s1", area: team }));
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));
			await settle();

			expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: teamTopLevel("t1") });
		});

		it("a demoted editor's save fails with a worded 403", async () => {
			server.on("PUT", "/api/situations/s1", problemResponse(403, { type: "https://tacticalboard/errors/forbidden" }));
			situationLink.attach(summaryOf({ id: "s1", area: team }));
			render(EditorPage);
			situationEditor.changeTitle("Changed");
			await settle();

			await fireEvent.click(saveButton());
			await settle();

			expect(screen.getByRole("alert")).toHaveTextContent("You may not change this situation (any more), e.g. because your role in the team changed.");
			expect(situationEditor.isDirty()).toBe(true);
		});

		describe("opened by a Reader", () => {
			beforeEach(() => {
				situationLink.attach(summaryOf({ id: "s1", folderId: "f1", area: team, canWrite: false }));
				render(EditorPage);
			});

			it("is read-only: no Save, no tools, no undo, no frame changes, read-only texts, with a note why", () => {
				expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
				expect(screen.getByRole("note")).toHaveTextContent("View only: you're a Reader in this team.");
				expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
				expect(screen.getByRole("button", { name: "Add frame" })).toBeDisabled();
				expect(screen.getByRole("textbox", { name: "Title" })).toBeDisabled();
				expect(screen.getByRole("textbox", { name: "Frame 1 description" })).toHaveAttribute("readonly");
				for (const tool of within(screen.getByRole("complementary", { name: "Tools" })).getAllByRole("button")) {
					expect(tool).toBeDisabled();
				}
			});

			it("keeps playback and the export available, and Ctrl+S does nothing", async () => {
				expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
				expect(screen.getByRole("region", { name: "Playback" })).toBeInTheDocument();

				await fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
				await settle();

				expect(server.requestsTo("/api/situations/s1")).toHaveLength(0);
			});

			it("leads the badge back to the team's folder, and New starts in the personal area", async () => {
				expect(badge("Back to the folder")).toHaveAttribute("href", "/folders/f1");

				await fireEvent.click(screen.getByRole("button", { name: "New" }));
				await settle();
				await fireEvent.click(screen.getByRole("button", { name: "Create" }));
				await settle();

				expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
				expect(screen.queryByRole("note")).toBeNull();
				expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
			});
		});
	});
});
