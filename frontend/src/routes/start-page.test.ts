import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { goto } from "$app/navigation";
import { authSession } from "$lib/auth/AuthSession";
import { situationEditor } from "$lib/editor/SituationEditor";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { situationLink } from "$lib/storage/SituationLink";
import type { FolderSummary } from "$lib/storage/FolderApi";
import { storedFrom, summaryOf } from "$lib/testing/storageFakes";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { Frame } from "$lib/model/Frame";
import { Situation } from "$lib/model/Situation";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import StartPage from "./+page.svelte";
import { accountLanguage, i18n } from "$lib/i18n";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => undefined) }));

function folderOf(id: string, name: string, situationCount = 0): FolderSummary {
	return { id, name, createdAt: "2026-10-04T08:00:00Z", updatedAt: "2026-10-04T08:00:00Z", situationCount };
}

function situationFile(name = "play.situation.json"): File {
	const situation = new Situation({
		id: "original",
		title: "Breakout",
		description: "",
		sport: "floorball",
		fieldType: "half",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: [new Frame("f1", "", [])],
	});
	return new File([new SituationSerializer().serialize(situation)], name, { type: "application/json" });
}

async function chooseFile(container: HTMLElement, file: File) {
	const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	await fireEvent.change(input);
}

/** Lets the async import (file read, confirmation) finish. */
async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("start page", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
		vi.mocked(goto).mockClear();
		situationEditor.createNew({ title: "Reset", fieldType: "full" });
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	describe("semantics", () => {
		it("has the shared navbar with the app name as h1, and the main landmark", () => {
			render(StartPage);

			const banner = screen.getByRole("banner");
			expect(within(banner).getByRole("heading", { level: 1, name: "Tactical Board" })).toBeInTheDocument();
			expect(within(banner).getByRole("link", { name: "Start page" })).toHaveAttribute("aria-current", "page");
			expect(within(banner).getByRole("navigation", { name: "Account" })).toBeInTheDocument();
			expect(screen.getByRole("main")).toBeInTheDocument();
		});

		it("offers New situation and Import as buttons", () => {
			render(StartPage);

			const start = screen.getByRole("region", { name: "Start" });
			const buttons = within(start).getAllByRole("button");
			expect(buttons.map((b) => b.textContent?.trim())).toEqual(["New situation", "Import"]);
			expect(buttons.every((b) => b.getAttribute("type") === "button")).toBe(true);
			expect(within(start).getByRole("list")).toBeInTheDocument();
		});

		it("has a Saved situations section", () => {
			render(StartPage);

			const saved = screen.getByRole("region", { name: "Saved situations" });
			expect(within(saved).getByRole("heading", { level: 2 })).toHaveTextContent("Saved situations");
		});

		it("hides decorative icons from assistive technology", () => {
			const { container } = render(StartPage);

			for (const svg of container.querySelectorAll("svg")) {
				expect(svg.closest("[aria-hidden='true']")).not.toBeNull();
			}
		});
	});

	describe("account", () => {
		afterEach(() => {
			vi.unstubAllGlobals();
			window.history.replaceState({}, "", "/");
		});

		async function sessionFrom(response: Response) {
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", response).fetch);
			await authSession.refresh();
		}

		it("offers Log in in the header when logged out, returning to the start page", async () => {
			await sessionFrom(problemResponse(401, {}));
			render(StartPage);

			const header = screen.getByRole("banner");
			expect(within(header).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/auth/login?returnUrl=%2F");
		});

		it("says when the login failed", async () => {
			window.history.replaceState({}, "", "/?login=failed");
			await sessionFrom(problemResponse(401, {}));
			render(StartPage);

			expect(within(screen.getByRole("banner")).getByRole("status")).toHaveTextContent("Login failed.");
		});

		it("says when the account is blocked", async () => {
			window.history.replaceState({}, "", "/?login=blocked");
			await sessionFrom(problemResponse(401, {}));
			render(StartPage);

			expect(within(screen.getByRole("banner")).getByRole("status")).toHaveTextContent("Account blocked.");
		});

		it("shows the user's menu in the header when logged in", async () => {
			await sessionFrom(jsonResponse(200, { id: "1", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null }));
			render(StartPage);

			expect(within(screen.getByRole("banner")).getByRole("button", { name: "Alice" })).toBeInTheDocument();
		});

		it("keeps local mode fully usable without a backend", async () => {
			await sessionFrom(new Response("proxy error", { status: 502 }));
			render(StartPage);

			expect(within(screen.getByRole("banner")).getByText("Local mode")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "New situation" })).toBeEnabled();
			expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
			expect(screen.queryByRole("alert")).toBeNull();
		});
	});

	describe("New situation", () => {
		it("opens the New situation dialog", async () => {
			render(StartPage);

			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			expect(screen.getByRole("dialog", { name: "New situation" })).toHaveAttribute("open");
		});

		it("creating a situation opens the editor with it", async () => {
			render(StartPage);
			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			await fireEvent.input(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Powerplay" } });
			await fireEvent.click(screen.getByRole("radio", { name: /half/i }));
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));

			expect(situationEditor.current()).toMatchObject({ title: "Powerplay", fieldType: "half" });
			expect(goto).toHaveBeenCalledWith("/editor");
		});

		it("cancelling stays on the start page", async () => {
			const before = situationEditor.current();
			render(StartPage);
			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(situationEditor.current()).toBe(before);
			expect(goto).not.toHaveBeenCalled();
		});

		it("asks to discard unsaved changes first (e.g. after going back from the editor)", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(StartPage);

			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
		});
	});

	describe("Import", () => {
		it("the Import button opens the file picker", async () => {
			const { container } = render(StartPage);
			const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
			const click = vi.spyOn(input, "click");

			await fireEvent.click(screen.getByRole("button", { name: "Import" }));

			expect(click).toHaveBeenCalledOnce();
			expect(input).toHaveAttribute("accept", ".json");
		});

		it("importing a valid file opens the editor with it", async () => {
			const { container } = render(StartPage);

			await chooseFile(container, situationFile());
			await settle();

			expect(situationEditor.current()).toMatchObject({ title: "Breakout", fieldType: "half" });
			expect(situationEditor.current().id).not.toBe("original");
			expect(goto).toHaveBeenCalledWith("/editor");
		});

		it("an invalid file stays on the start page", async () => {
			const before = situationEditor.current();
			const { container } = render(StartPage);

			await chooseFile(container, new File(["{nope"], "broken.json"));
			await settle();

			expect(situationEditor.current()).toBe(before);
			expect(goto).not.toHaveBeenCalled();
		});

		it("resets the file input so the same file can be chosen again", async () => {
			const { container } = render(StartPage);
			const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
			input.value = "";
			const setter = vi.spyOn(input, "value", "set");

			await chooseFile(container, situationFile());
			await settle();

			expect(setter).toHaveBeenCalledWith("");
		});
	});

	describe("saved situations", () => {
		const alice = { id: "u1", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null };
		let server: FakeFetch;

		function savedSection() {
			return screen.getByRole("region", { name: "Saved situations" });
		}

		async function loggedInWith(situations = [summaryOf({ id: "s1", title: "Powerplay" })], folders: FolderSummary[] = []) {
			server = new FakeFetch()
				.on("GET", "/api/me", jsonResponse(200, alice))
				.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY))
				.on("GET", "/api/personal-area/situations", jsonResponse(200, situations))
				.on("GET", "/api/personal-area/folders", jsonResponse(200, folders));
			vi.stubGlobal("fetch", server.fetch);
			await authSession.refresh();
		}

		function serverSituation(id = "s1") {
			const editor = situationEditor.current();
			situationEditor.createNew({ title: "Powerplay", fieldType: "half" });
			const stored = storedFrom(situationEditor.current(), { id, title: "Powerplay", revision: 2 });
			situationEditor.load(editor);
			return stored;
		}

		afterEach(() => {
			vi.unstubAllGlobals();
			situationLink.reset();
		});

		it("asks to log in when logged out", async () => {
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", problemResponse(401, {})).fetch);
			await authSession.refresh();
			render(StartPage);

			expect(savedSection()).toHaveTextContent("Log in to save situations on the server and find them here.");
		});

		it("explains that local mode works without a server", async () => {
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", new Response("proxy error", { status: 502 })).fetch);
			await authSession.refresh();
			render(StartPage);

			expect(savedSection()).toHaveTextContent(/can't be reached\. Creating, editing, export and import work as usual\./);
			expect(screen.getByRole("button", { name: "New situation" })).toBeEnabled();
		});

		it("lists the personal area's situations when logged in", async () => {
			await loggedInWith([summaryOf({ id: "s1", title: "Powerplay" }), summaryOf({ id: "s2", title: "Breakout" })]);
			render(StartPage);
			await settle();

			const situations = screen.getByRole("region", { name: "Situations" });
			const items = within(within(situations).getByRole("list")).getAllByRole("listitem");
			expect(items.map((item) => within(item).getAllByRole("button")[0].textContent?.trim())).toEqual(["Powerplay", "Breakout"]);
		});

		it("splits the saved situations into Folders and Situations (the top level) when logged in", async () => {
			await loggedInWith();
			render(StartPage);
			await settle();

			const parts = within(savedSection()).getAllByRole("region");
			expect(parts.map((part) => within(part).getByRole("heading", { level: 3 }).textContent)).toEqual(["Folders", "Situations"]);
			expect(within(parts[0]).getByText("No folders yet.")).toBeInTheDocument();
			expect(server.requestsTo("/api/personal-area/situations")).toHaveLength(1);
		});

		it("lists the folders as links to their pages", async () => {
			await loggedInWith([], [folderOf("f1", "Breakouts", 1), folderOf("f2", "Set pieces", 4)]);
			render(StartPage);
			await settle();

			const folders = screen.getByRole("region", { name: "Folders" });
			expect(within(folders).getAllByRole("link").map((link) => [link.textContent?.replace(/\s+/g, " ").trim(), link.getAttribute("href")])).toEqual([
				["Breakouts 1 situation", "/folders/f1"],
				["Set pieces 4 situations", "/folders/f2"],
			]);
			expect(screen.getByRole("region", { name: "Situations" })).toHaveTextContent("No situations outside the folders.");
		});

		it("shows no folder parts without login", async () => {
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", problemResponse(401, {})).fetch);
			await authSession.refresh();
			render(StartPage);

			expect(within(savedSection()).queryByRole("region")).toBeNull();
			expect(screen.queryByRole("button", { name: "New folder" })).toBeNull();
		});

		it("creates a folder with New folder and lists it", async () => {
			await loggedInWith();
			server.on("POST", "/api/personal-area/folders", jsonResponse(201, folderOf("f1", "Set pieces")));
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "New folder" }));
			await settle();
			const dialog = screen.getByRole("dialog", { name: "New folder" });
			server.on("GET", "/api/personal-area/folders", jsonResponse(200, [folderOf("f1", "Set pieces")]));
			await fireEvent.input(within(dialog).getByRole("textbox", { name: "Folder name" }), { target: { value: " Set pieces " } });
			await fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
			await settle();

			const [post] = server.requestsTo("/api/personal-area/folders").filter((request) => request.method === "POST");
			expect(JSON.parse(post.body!)).toEqual({ name: "Set pieces" });
			expect(dialog).not.toHaveAttribute("open");
			expect(within(screen.getByRole("region", { name: "Folders" })).getByRole("link", { name: "Set pieces 0 situations" })).toBeInTheDocument();
		});

		it("in German: the page, the dialog and the server's refusal are German", async () => {
			i18n.select("de");
			await loggedInWith([], [folderOf("f1", "Set pieces")]);
			server.on("POST", "/api/personal-area/folders", problemResponse(409, { type: "https://tacticalboard/errors/duplicate-folder-name", detail: "English." }));
			render(StartPage);
			await settle();

			expect(screen.getByRole("region", { name: "Start" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Neue Situation" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Importieren" })).toBeInTheDocument();
			expect(screen.getByRole("region", { name: "Gespeicherte Situationen" })).toBeInTheDocument();
			expect(screen.getByText("Keine Situationen außerhalb der Ordner.")).toBeInTheDocument();

			await fireEvent.click(screen.getByRole("button", { name: "Neuer Ordner" }));
			await settle();
			const dialog = screen.getByRole("dialog", { name: "Neuer Ordner" });
			await fireEvent.input(within(dialog).getByRole("textbox", { name: "Ordnername" }), { target: { value: "set pieces" } });
			await fireEvent.click(within(dialog).getByRole("button", { name: "Erstellen" }));
			await settle();

			expect(within(dialog).getByRole("alert")).toHaveTextContent("Ein Ordner namens „set pieces“ existiert bereits. Wähle einen anderen Namen.");
		});

		it("on login, the account's language wins", async () => {
			vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", problemResponse(401, {})).fetch);
			await authSession.refresh();
			const detach = accountLanguage.attach();
			try {
				server = new FakeFetch()
					.on("GET", "/api/me", jsonResponse(200, { ...alice, preferredLanguage: "de" }))
					.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY))
					.on("GET", "/api/personal-area/situations", jsonResponse(200, []))
					.on("GET", "/api/personal-area/folders", jsonResponse(200, []));
				vi.stubGlobal("fetch", server.fetch);
				render(StartPage);
				expect(screen.getByRole("region", { name: "Saved situations" })).toBeInTheDocument();

				await authSession.refresh();
				await settle();

				expect(screen.getByRole("region", { name: "Gespeicherte Situationen" })).toBeInTheDocument();
				expect(document.documentElement.lang).toBe("de");
			} finally {
				detach();
			}
		});

		it("choosing a language when logged in stores it in the account", async () => {
			const detach = accountLanguage.attach();
			try {
				await loggedInWith();
				server.on("PUT", "/api/me/language", jsonResponse(200, { ...alice, preferredLanguage: "de" }));
				render(StartPage);
				await settle();

				await fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "de" } });
				await settle();

				const [put] = server.requestsTo("/api/me/language");
				expect(JSON.parse(put.body!)).toEqual({ language: "de" });
				expect(screen.getByRole("combobox", { name: "Sprache" })).toHaveValue("de");
			} finally {
				detach();
			}
		});

		it("keeps the New folder dialog open with the reason when the name is taken", async () => {
			await loggedInWith([], [folderOf("f1", "Set pieces")]);
			server.on("POST", "/api/personal-area/folders", problemResponse(409, { type: "https://tacticalboard/errors/duplicate-folder-name" }));
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "New folder" }));
			await settle();
			const dialog = screen.getByRole("dialog", { name: "New folder" });
			await fireEvent.input(within(dialog).getByRole("textbox", { name: "Folder name" }), { target: { value: "set pieces" } });
			await fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
			await settle();

			expect(within(dialog).getByRole("alert")).toHaveTextContent("A folder named “set pieces” already exists. Choose another name.");
			expect(dialog).toHaveAttribute("open");
		});

		it("moves a top-level situation into a folder with Move", async () => {
			await loggedInWith([summaryOf({ id: "s1", title: "Powerplay" })], [folderOf("f1", "Breakouts")]);
			server.on("PUT", "/api/situations/s1/folder", jsonResponse(200, summaryOf({ id: "s1", title: "Powerplay", folderId: "f1" })));
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Move “Powerplay”" }));
			await settle();
			const dialog = screen.getByRole("dialog", { name: "Move “Powerplay”" });
			expect(within(dialog).getByRole("radio", { name: /Top level/ })).toBeChecked();
			server.on("GET", "/api/personal-area/situations", jsonResponse(200, []));
			await fireEvent.click(within(dialog).getByRole("radio", { name: /Breakouts/ }));
			await fireEvent.click(within(dialog).getByRole("button", { name: "Move" }));
			await settle();

			expect(JSON.parse(server.requestsTo("/api/situations/s1/folder")[0].body!)).toEqual({ folderId: "f1" });
			expect(dialog).not.toHaveAttribute("open");
			expect(screen.getByRole("region", { name: "Situations" })).toHaveTextContent("No situations outside the folders.");
		});

		it("a new situation from the start page is started at the top level", async () => {
			await loggedInWith();
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));

			expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: { folderId: null } });
		});

		it("opens a saved situation in the editor", async () => {
			await loggedInWith();
			server.on("GET", "/api/situations/s1", jsonResponse(200, serverSituation()));
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Powerplay" }));
			await settle();

			expect(situationEditor.current()).toMatchObject({ id: "s1", title: "Powerplay", fieldType: "half" });
			expect(situationLink.saved()?.revision).toBe(2);
			expect(goto).toHaveBeenCalledWith("/editor?situation=s1");
		});

		it("asks to discard unsaved changes before opening, like an import", async () => {
			await loggedInWith();
			server.on("GET", "/api/situations/s1", jsonResponse(200, serverSituation()));
			situationEditor.addElement(1, 1, "red", "Player");
			const before = situationEditor.current();
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Powerplay" }));
			await settle();
			expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			await settle();

			expect(situationEditor.current()).toBe(before);
			expect(goto).not.toHaveBeenCalled();
		});

		it("says when a situation can't be opened and reloads the list", async () => {
			await loggedInWith();
			server.on("GET", "/api/situations/s1", problemResponse(404, {}));
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Powerplay" }));
			await settle();

			expect(within(savedSection()).getByRole("alert")).toHaveTextContent('“Powerplay” couldn\'t be opened. This situation no longer exists.');
			expect(server.requestsTo("/api/personal-area/situations").length).toBeGreaterThanOrEqual(2);
			expect(goto).not.toHaveBeenCalled();
		});

		it("deletes a situation after confirmation and reloads the list", async () => {
			await loggedInWith();
			server.on("DELETE", "/api/situations/s1", new Response(null, { status: 204 }));
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Delete “Powerplay”" }));
			await settle();
			const dialog = screen.getByRole("alertdialog", { name: "Delete situation?" });
			expect(dialog).toHaveAccessibleDescription("“Powerplay” will be deleted.");
			server.on("GET", "/api/personal-area/situations", jsonResponse(200, []));
			await fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
			await settle();

			expect(server.requestsTo("/api/situations/s1").map((request) => request.method)).toEqual(["DELETE"]);
			expect(savedSection()).toHaveTextContent("No saved situations yet.");
			expect(server.requestsTo("/api/situations/s1/folder")).toEqual([]);
		});

		it("keeps the situation when the deletion is cancelled", async () => {
			await loggedInWith();
			render(StartPage);
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Delete “Powerplay”" }));
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			await settle();

			expect(server.requestsTo("/api/situations/s1")).toEqual([]);
			expect(screen.getByRole("button", { name: "Powerplay" })).toBeInTheDocument();
		});
	});
});
