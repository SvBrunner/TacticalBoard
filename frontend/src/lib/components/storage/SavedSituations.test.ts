import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import type { SessionState } from "$lib/auth/AuthSession";
import type { SavedListState } from "$lib/storage/SavedSituationList";
import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";
import { summaryOf } from "$lib/testing/storageFakes";
import SavedSituations from "./SavedSituations.svelte";
import SavedSituationsWithEmptyActions from "./SavedSituationsWithEmptyActions.test.svelte";

const loggedIn: SessionState = { status: "authenticated", user: { id: "u1", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null } };

function renderWith(session: SessionState, list: SavedListState = { status: "idle" }, busy = false, emptyMessage?: string) {
	const handlers = { onOpen: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onRetry: vi.fn() };
	render(SavedSituations, { props: { session, list, busy, emptyMessage, ...handlers } });
	return handlers;
}

const powerplay = summaryOf({
	id: "s1",
	title: "Powerplay",
	fieldType: "half",
	createdBy: { id: "u2", displayName: "Bob" },
	updatedBy: { id: "u1", displayName: null },
	updatedAt: "2026-10-04T09:30:00.000Z",
});

describe("SavedSituations", () => {
	afterEach(() => cleanup());

	it("shows nothing while the login state is unknown", () => {
		const { container } = render(SavedSituations, {
			props: { session: { status: "unknown" }, list: { status: "idle" }, onOpen: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onRetry: vi.fn() },
		});

		expect(container.textContent?.trim()).toBe("");
	});

	it("asks to log in when logged out", () => {
		renderWith({ status: "anonymous" });

		expect(screen.getByText("Log in to save situations on the server and find them here.")).toBeInTheDocument();
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("says that local mode works without a server", () => {
		renderWith({ status: "unavailable" });

		expect(screen.getByText(/can't be reached\. Creating, editing, export and import work as usual\./)).toBeInTheDocument();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("says it is loading", () => {
		renderWith(loggedIn, { status: "loading" });

		expect(screen.getByRole("status")).toHaveTextContent("Loading saved situations…");
	});

	it("shows a failure with Try again", async () => {
		const { onRetry } = renderWith(loggedIn, { status: "failed", message: () => "The server is not reachable." });

		expect(screen.getByRole("alert")).toHaveTextContent("The server is not reachable.");
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("has an empty state", () => {
		renderWith(loggedIn, { status: "loaded", situations: [] });

		expect(screen.getByText(/No saved situations yet\./)).toBeInTheDocument();
	});

	it("shows the place's own empty message", () => {
		renderWith(loggedIn, { status: "loaded", situations: [] }, false, "This folder is empty.");

		expect(screen.getByText("This folder is empty.")).toBeInTheDocument();
		expect(screen.queryByText(/No saved situations yet/)).toBeNull();
	});

	it("offers the place's empty actions below the empty message", () => {
		render(SavedSituationsWithEmptyActions, { props: { session: loggedIn, list: { status: "loaded", situations: [] } } });

		const message = screen.getByText("This folder is empty.");
		const action = screen.getByRole("button", { name: "Start here" });
		expect(message.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it.each<[string, SavedListState]>([
		["loading", { status: "loading" }],
		["failed", { status: "failed", message: () => "Failed." }],
		["listing situations", { status: "loaded", situations: [powerplay] }],
	])("shows no empty actions while %s", (_, list) => {
		render(SavedSituationsWithEmptyActions, { props: { session: loggedIn, list } });

		expect(screen.queryByRole("button", { name: "Start here" })).toBeNull();
	});

	it("shows no empty actions without login", () => {
		render(SavedSituationsWithEmptyActions, { props: { session: { status: "anonymous" }, list: { status: "loaded", situations: [] } } });

		expect(screen.queryByRole("button", { name: "Start here" })).toBeNull();
	});

	it("lists the situations with title, field type, last change and creator", () => {
		renderWith(loggedIn, { status: "loaded", situations: [powerplay, summaryOf({ id: "s2", title: "Breakout" })] });

		const items = within(screen.getByRole("list")).getAllByRole("listitem");
		expect(items).toHaveLength(2);
		const open = within(items[0]).getByRole("button", { name: "Powerplay" });
		expect(open).toHaveAccessibleDescription(
			`Half field Last changed by Deleted user, ${SavedSituationFormat.dateTime("2026-10-04T09:30:00.000Z", "en")} Created by Bob`,
		);
		expect(items[0].querySelector("time")).toHaveAttribute("datetime", "2026-10-04T09:30:00.000Z");
		expect(within(items[1]).getByRole("button", { name: "Breakout" })).toBeInTheDocument();
	});

	it("opens a situation with its title button", async () => {
		const { onOpen } = renderWith(loggedIn, { status: "loaded", situations: [powerplay] });

		await fireEvent.click(screen.getByRole("button", { name: "Powerplay" }));

		expect(onOpen).toHaveBeenCalledWith(powerplay);
	});

	it("deletes a situation with its Delete button", async () => {
		const { onDelete } = renderWith(loggedIn, { status: "loaded", situations: [powerplay] });

		await fireEvent.click(screen.getByRole("button", { name: "Delete “Powerplay”" }));

		expect(onDelete).toHaveBeenCalledWith(powerplay);
	});

	it("offers moving a situation with its Move button", async () => {
		const { onMove } = renderWith(loggedIn, { status: "loaded", situations: [powerplay] });

		const move = screen.getByRole("button", { name: "Move “Powerplay”" });
		expect(move).toHaveTextContent("Move");
		await fireEvent.click(move);

		expect(onMove).toHaveBeenCalledWith(powerplay);
	});

	it("orders each situation's buttons: open, move, delete", () => {
		renderWith(loggedIn, { status: "loaded", situations: [powerplay] });

		const item = within(screen.getByRole("list")).getByRole("listitem");
		expect(within(item).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim())).toEqual([
			"Powerplay",
			"Move “Powerplay”",
			"Delete “Powerplay”",
		]);
	});

	it("disables the buttons while busy", () => {
		renderWith(loggedIn, { status: "loaded", situations: [powerplay] }, true);

		expect(screen.getByRole("button", { name: "Powerplay" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Move “Powerplay”" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Delete “Powerplay”" })).toBeDisabled();
	});

	it("uses real buttons and hides icons from assistive technology", () => {
		const { container } = render(SavedSituations, {
			props: {
				session: loggedIn,
				list: { status: "loaded", situations: [powerplay] },
				onOpen: vi.fn(),
				onDelete: vi.fn(),
				onMove: vi.fn(),
				onRetry: vi.fn(),
			},
		});

		expect(screen.getAllByRole("button").every((button) => button.getAttribute("type") === "button")).toBe(true);
		for (const svg of container.querySelectorAll("svg")) {
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});
});
