import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import type { SessionState } from "$lib/auth/AuthSession";
import type { SavedListState } from "$lib/storage/SavedSituationList";
import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";
import { summaryOf } from "$lib/testing/storageFakes";
import SavedSituations from "./SavedSituations.svelte";

const loggedIn: SessionState = { status: "authenticated", user: { id: "u1", displayName: "Alice", isSystemAdministrator: false } };

function renderWith(session: SessionState, list: SavedListState = { status: "idle" }, busy = false) {
	const handlers = { onOpen: vi.fn(), onDelete: vi.fn(), onRetry: vi.fn() };
	render(SavedSituations, { props: { session, list, busy, ...handlers } });
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
			props: { session: { status: "unknown" }, list: { status: "idle" }, onOpen: vi.fn(), onDelete: vi.fn(), onRetry: vi.fn() },
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
		const { onRetry } = renderWith(loggedIn, { status: "failed", message: "The server is not reachable." });

		expect(screen.getByRole("alert")).toHaveTextContent("The server is not reachable.");
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("has an empty state", () => {
		renderWith(loggedIn, { status: "loaded", situations: [] });

		expect(screen.getByText(/No saved situations yet\./)).toBeInTheDocument();
	});

	it("lists the situations with title, field type, last change and creator", () => {
		renderWith(loggedIn, { status: "loaded", situations: [powerplay, summaryOf({ id: "s2", title: "Breakout" })] });

		const items = within(screen.getByRole("list")).getAllByRole("listitem");
		expect(items).toHaveLength(2);
		const open = within(items[0]).getByRole("button", { name: "Powerplay" });
		expect(open).toHaveAccessibleDescription(
			`Half field Last changed by Deleted user, ${SavedSituationFormat.dateTime("2026-10-04T09:30:00.000Z")} Created by Bob`,
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

	it("disables the buttons while busy", () => {
		renderWith(loggedIn, { status: "loaded", situations: [powerplay] }, true);

		expect(screen.getByRole("button", { name: "Powerplay" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Delete “Powerplay”" })).toBeDisabled();
	});

	it("uses real buttons and hides icons from assistive technology", () => {
		const { container } = render(SavedSituations, {
			props: { session: loggedIn, list: { status: "loaded", situations: [powerplay] }, onOpen: vi.fn(), onDelete: vi.fn(), onRetry: vi.fn() },
		});

		expect(screen.getAllByRole("button").every((button) => button.getAttribute("type") === "button")).toBe(true);
		for (const svg of container.querySelectorAll("svg")) {
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});
});
