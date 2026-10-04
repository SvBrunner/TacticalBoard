import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { goto } from "$app/navigation";
import { authSession } from "$lib/auth/AuthSession";
import { situationEditor } from "$lib/editor/SituationEditor";
import { Frame } from "$lib/model/Frame";
import { Situation } from "$lib/model/Situation";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import type { Folder } from "$lib/storage/FolderApi";
import { situationLink } from "$lib/storage/SituationLink";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { storedFrom, summaryOf } from "$lib/testing/storageFakes";
import FolderRoutePage from "./+page.svelte";
import { load } from "./+page";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => undefined) }));

const alice = { id: "u1", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null };

function folderOf(id: string, name: string): Folder {
	return { id, name, createdAt: "2026-10-04T08:00:00Z", updatedAt: "2026-10-04T08:00:00Z" };
}

/** Lets the async loads, confirmations and their DOM updates finish. */
async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("folder route", () => {
	it("hands the folder id from the URL to the page", () => {
		expect(load({ params: { id: "f1" } } as unknown as Parameters<typeof load>[0])).toEqual({ folderId: "f1" });
	});
});

describe("folder page", () => {
	let restore: () => void;
	let server: FakeFetch;

	beforeEach(() => {
		restore = installDialogPolyfill();
		vi.mocked(goto).mockClear();
		situationEditor.createNew({ title: "Reset", fieldType: "full" });
		situationLink.reset();
	});

	afterEach(() => {
		cleanup();
		restore();
		vi.unstubAllGlobals();
		situationLink.reset();
	});

	async function loggedInWith(situations = [summaryOf({ id: "s1", title: "Powerplay", folderId: "f1" })], folder: Folder = folderOf("f1", "Set pieces")) {
		server = new FakeFetch()
			.on("GET", "/api/me", jsonResponse(200, alice))
			.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY))
			.on("GET", `/api/folders/${folder.id}`, jsonResponse(200, folder))
			.on("GET", `/api/folders/${folder.id}/situations`, jsonResponse(200, situations))
			.on("GET", "/api/personal-area/folders", jsonResponse(200, [folderOf("f0", "Breakouts"), folder]));
		vi.stubGlobal("fetch", server.fetch);
		await authSession.refresh();
	}

	async function renderPage(folderId = "f1") {
		const view = render(FolderRoutePage, { props: { data: { folderId } } });
		await settle();
		return view;
	}

	const situationsSection = () => screen.getByRole("region", { name: "Situations" });

	describe("semantics", () => {
		it("has the navbar with the folder's name as h1, a breadcrumb back to the start page and the main landmark", async () => {
			await loggedInWith();
			await renderPage();

			const banner = screen.getByRole("banner");
			expect(within(banner).getByRole("heading", { level: 1, name: "Set pieces" })).toBeInTheDocument();
			expect(within(banner).getByRole("link", { name: "Start page" })).not.toHaveAttribute("aria-current");
			const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
			expect(within(breadcrumb).getByRole("link", { name: "Start page" })).toHaveAttribute("href", "/");
			expect(within(breadcrumb).getByText("Set pieces")).toHaveAttribute("aria-current", "page");
			expect(within(breadcrumb).getByRole("list").tagName).toBe("OL");
			expect(screen.getByRole("main")).toBeInTheDocument();
		});

		it("has the folder's actions, Start in this folder, and its Situations as sections", async () => {
			await loggedInWith();
			const { container } = await renderPage();

			const folder = screen.getByRole("region", { name: "Folder" });
			expect(within(folder).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["Rename", "Delete folder"]);
			const start = screen.getByRole("region", { name: "Start in this folder" });
			expect(within(start).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["New situation", "Import"]);
			expect(situationsSection()).toBeInTheDocument();
			for (const svg of container.querySelectorAll("main svg")) {
				expect(svg).toHaveAttribute("aria-hidden", "true");
			}
		});
	});

	it("asks to log in when logged out, and returns here after the login", async () => {
		vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", problemResponse(401, {})).fetch);
		await authSession.refresh();
		await renderPage();

		expect(screen.getByRole("main")).toHaveTextContent("Log in to see your folders.");
		expect(within(screen.getByRole("banner")).getByRole("link", { name: "Log in" })).toHaveAttribute(
			"href",
			"/auth/login?returnUrl=%2Ffolders%2Ff1",
		);
		expect(screen.queryByRole("region")).toBeNull();
	});

	it("explains that folders need the server", async () => {
		vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", new Response("proxy error", { status: 502 })).fetch);
		await authSession.refresh();
		await renderPage();

		expect(screen.getByRole("main")).toHaveTextContent(/Folders need the server, which can't be reached\./);
	});

	it("says when the folder doesn't exist (any more)", async () => {
		await loggedInWith();
		server.on("GET", "/api/folders/f1", problemResponse(404, { type: "https://tacticalboard/errors/folder-not-found" }));
		await renderPage();

		expect(screen.getByRole("main")).toHaveTextContent("This folder doesn't exist (any more).");
		expect(within(screen.getByRole("main")).getByRole("link", { name: "Back to the start page" })).toHaveAttribute("href", "/");
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Folder");
	});

	it("offers Try again when the folder can't be loaded", async () => {
		await loggedInWith();
		server.failOn("GET", "/api/folders/f1");
		await renderPage();

		expect(screen.getByRole("alert")).toHaveTextContent("The server is not reachable.");
		server.on("GET", "/api/folders/f1", jsonResponse(200, folderOf("f1", "Set pieces")));
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		await settle();

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Set pieces");
	});

	it("lists the folder's situations", async () => {
		await loggedInWith([summaryOf({ id: "s1", title: "Powerplay", folderId: "f1" }), summaryOf({ id: "s2", title: "Corner", folderId: "f1" })]);
		await renderPage();

		const items = within(within(situationsSection()).getByRole("list")).getAllByRole("listitem");
		expect(items.map((item) => within(item).getAllByRole("button")[0].textContent?.trim())).toEqual(["Powerplay", "Corner"]);
	});

	it("says when the folder is empty", async () => {
		await loggedInWith([]);
		await renderPage();

		expect(situationsSection()).toHaveTextContent("This folder is empty. Start a new situation or import one here, or move situations into it.");
	});

	it("starts a new situation in this folder (its first save goes here)", async () => {
		await loggedInWith();
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
		await settle();
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "new", target: { folderId: "f1" } });
		expect(goto).toHaveBeenCalledWith("/editor");
	});

	it("imports into this folder", async () => {
		await loggedInWith();
		const { container } = await renderPage();
		const situation = new Situation({
			id: "x",
			title: "Imported",
			description: "",
			sport: "floorball",
			fieldType: "full",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			frames: [new Frame("f1", "", [])],
		});
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		Object.defineProperty(input, "files", { value: [new File([new SituationSerializer().serialize(situation)], "x.json")], configurable: true });

		await fireEvent.change(input);
		await settle();

		expect(situationLink.current()).toEqual({ kind: "unsaved", origin: "imported", target: { folderId: "f1" } });
		expect(goto).toHaveBeenCalledWith("/editor");
	});

	it("opens a situation in the editor", async () => {
		await loggedInWith();
		const editor = situationEditor.current();
		situationEditor.createNew({ title: "Powerplay", fieldType: "half" });
		const stored = storedFrom(situationEditor.current(), { id: "s1", title: "Powerplay", folderId: "f1" });
		situationEditor.load(editor);
		server.on("GET", "/api/situations/s1", jsonResponse(200, stored));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Powerplay" }));
		await settle();

		expect(goto).toHaveBeenCalledWith("/editor?situation=s1");
		expect(situationLink.saved()?.folderId).toBe("f1");
	});

	it("deletes a situation after confirmation", async () => {
		await loggedInWith();
		server.on("DELETE", "/api/situations/s1", new Response(null, { status: 204 }));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete “Powerplay”" }));
		await settle();
		server.on("GET", "/api/folders/f1/situations", jsonResponse(200, []));
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete situation?" })).getByRole("button", { name: "Delete" }));
		await settle();

		expect(server.requestsTo("/api/situations/s1").map((request) => request.method)).toEqual(["DELETE"]);
		expect(situationsSection()).toHaveTextContent("This folder is empty.");
	});

	it("moves a situation to the top level or another folder", async () => {
		await loggedInWith();
		server.on("PUT", "/api/situations/s1/folder", jsonResponse(200, summaryOf({ id: "s1", folderId: null })));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Move “Powerplay”" }));
		await settle();
		const dialog = screen.getByRole("dialog", { name: "Move “Powerplay”" });
		expect(within(dialog).getAllByRole("radio").map((radio) => radio.closest("label")?.querySelector(".place-name")?.textContent)).toEqual([
			"Top level (no folder)",
			"Breakouts",
			"Set pieces",
		]);
		expect(within(dialog).getByRole("radio", { name: /Set pieces/ })).toBeChecked();
		server.on("GET", "/api/folders/f1/situations", jsonResponse(200, []));
		await fireEvent.click(within(dialog).getByRole("radio", { name: /Top level/ }));
		await fireEvent.click(within(dialog).getByRole("button", { name: "Move" }));
		await settle();

		expect(JSON.parse(server.requestsTo("/api/situations/s1/folder")[0].body!)).toEqual({ folderId: null });
		expect(situationsSection()).toHaveTextContent("This folder is empty.");
	});

	it("renames the folder", async () => {
		await loggedInWith();
		server.on("PUT", "/api/folders/f1", jsonResponse(200, folderOf("f1", "Corners")));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
		await settle();
		const dialog = screen.getByRole("dialog", { name: "Rename folder" });
		const input = within(dialog).getByRole("textbox", { name: "Folder name" }) as HTMLInputElement;
		expect(input.value).toBe("Set pieces");
		await fireEvent.input(input, { target: { value: "Corners" } });
		await fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
		await settle();

		expect(JSON.parse(server.requestsTo("/api/folders/f1").find((request) => request.method === "PUT")!.body!)).toEqual({ name: "Corners" });
		expect(dialog).not.toHaveAttribute("open");
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Corners");
	});

	it("refuses to delete a folder with situations and says why, without asking the server", async () => {
		await loggedInWith();
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Folder" })).getByRole("alert")).toHaveTextContent(
			"“Set pieces” can't be deleted because it still contains situations. Move or delete them first.",
		);
		expect(server.requestsTo("/api/folders/f1").map((request) => request.method)).toEqual(["GET"]);
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("forgets the “can't be deleted” reason once a situation was moved out", async () => {
		await loggedInWith();
		server.on("PUT", "/api/situations/s1/folder", jsonResponse(200, summaryOf({ id: "s1", folderId: null })));
		await renderPage();
		const folderSection = () => screen.getByRole("region", { name: "Folder" });

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();
		expect(within(folderSection()).getByRole("alert")).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Move “Powerplay”" }));
		await settle();
		await fireEvent.click(screen.getByRole("radio", { name: /Top level/ }));
		await fireEvent.click(screen.getByRole("button", { name: "Move" }));
		await settle();
		expect(within(folderSection()).queryByRole("alert")).toBeNull();
	});

	it("forgets the reason when the folder is renamed", async () => {
		await loggedInWith();
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();
		await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Folder" })).queryByRole("alert")).toBeNull();
	});

	it("forgets the reason after a situation of the folder was deleted", async () => {
		await loggedInWith();
		server.on("DELETE", "/api/situations/s1", new Response(null, { status: 204 }));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();
		await fireEvent.click(screen.getByRole("button", { name: "Delete “Powerplay”" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete situation?" })).getByRole("button", { name: "Delete" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Folder" })).queryByRole("alert")).toBeNull();
	});

	it("deletes an empty folder after confirmation and goes back to the start page", async () => {
		await loggedInWith([]);
		server.on("DELETE", "/api/folders/f1", new Response(null, { status: 204 }));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();
		const question = screen.getByRole("alertdialog", { name: "Delete folder?" });
		expect(question).toHaveAccessibleDescription("“Set pieces” will be deleted.");
		await fireEvent.click(within(question).getByRole("button", { name: "Delete" }));
		await settle();

		expect(server.requestsTo("/api/folders/f1").map((request) => request.method)).toEqual(["GET", "DELETE"]);
		expect(goto).toHaveBeenCalledWith("/");
	});

	it("keeps the folder when the deletion is cancelled", async () => {
		await loggedInWith([]);
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete folder?" })).getByRole("button", { name: "Cancel" }));
		await settle();

		expect(server.requestsTo("/api/folders/f1").map((request) => request.method)).toEqual(["GET"]);
		expect(goto).not.toHaveBeenCalled();
	});

	it("shows the server's reason when situations got into the folder meanwhile", async () => {
		await loggedInWith([]);
		server.on("DELETE", "/api/folders/f1", problemResponse(409, { type: "https://tacticalboard/errors/folder-not-empty" }));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete folder?" })).getByRole("button", { name: "Delete" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Folder" })).getByRole("alert")).toHaveTextContent("still contains situations");
		expect(goto).not.toHaveBeenCalled();
	});

	it("starts fresh when navigating to another folder's page", async () => {
		await loggedInWith();
		server
			.on("GET", "/api/folders/f2", jsonResponse(200, folderOf("f2", "Corners")))
			.on("GET", "/api/folders/f2/situations", jsonResponse(200, []));
		const { rerender } = await renderPage();

		await rerender({ data: { folderId: "f2" } });
		await settle();

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Corners");
		expect(situationsSection()).toHaveTextContent("This folder is empty.");
	});
});
