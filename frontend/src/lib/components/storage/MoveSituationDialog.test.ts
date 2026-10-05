import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import type { Folder } from "$lib/storage/FolderApi";
import { summaryOf } from "$lib/testing/storageFakes";
import MoveSituationDialog from "./MoveSituationDialog.svelte";

const folders: Folder[] = [
	{ id: "f1", name: "Breakouts", createdAt: "", updatedAt: "", area: { kind: "personal", id: "u1" }, canWrite: true },
	{ id: "f2", name: "Set pieces", createdAt: "", updatedAt: "", area: { kind: "personal", id: "u1" }, canWrite: true },
];

describe("MoveSituationDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	function renderFor(situation = summaryOf({ id: "s1", title: "Powerplay", folderId: null }), places = folders) {
		const handlers = { onMove: vi.fn(), onCancel: vi.fn() };
		const view = render(MoveSituationDialog, { props: { situation, folders: places, ...handlers } });
		return { ...handlers, ...view };
	}

	const dialog = () => screen.getByRole("dialog", { name: "Move “Powerplay”" }) as HTMLDialogElement;

	it("is closed without a situation", () => {
		const { container } = render(MoveSituationDialog, { props: { situation: null, folders, onMove: vi.fn(), onCancel: vi.fn() } });

		expect(container.querySelector("dialog")?.open).toBe(false);
	});

	it("lists the top level and every folder as radio buttons in a “Move to” group", () => {
		renderFor();

		expect(dialog().open).toBe(true);
		const group = within(dialog()).getByRole("group", { name: "Move to" });
		expect(within(group).getAllByRole("radio").map((radio) => radio.closest("label")?.querySelector(".place-name")?.textContent)).toEqual([
			"Top level (no folder)",
			"Breakouts",
			"Set pieces",
		]);
	});

	it("preselects, marks and focuses the current place; Move waits for another choice", () => {
		renderFor(summaryOf({ id: "s1", title: "Powerplay", folderId: "f2" }));

		const current = screen.getByRole("radio", { name: /Set pieces/ });
		expect(current).toBeChecked();
		expect(current).toHaveFocus();
		expect(current.closest("label")).toHaveTextContent("(current)");
		expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
	});

	it("moves into the chosen folder", async () => {
		const { onMove } = renderFor();

		await fireEvent.click(screen.getByRole("radio", { name: /Breakouts/ }));
		await fireEvent.click(screen.getByRole("button", { name: "Move" }));

		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), "f1");
	});

	it("moves to the top level as null", async () => {
		const { onMove } = renderFor(summaryOf({ id: "s1", title: "Powerplay", folderId: "f1" }));

		await fireEvent.click(screen.getByRole("radio", { name: /Top level/ }));
		await fireEvent.click(screen.getByRole("button", { name: "Move" }));

		expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), null);
	});

	it("doesn't move to where it already is", async () => {
		const { onMove } = renderFor();

		await fireEvent.submit(dialog().querySelector("form")!);

		expect(onMove).not.toHaveBeenCalled();
	});

	it("says when there are no folders yet", () => {
		renderFor(undefined, []);

		expect(within(dialog()).getByText("There are no folders here yet. Create one first.")).toBeInTheDocument();
		expect(screen.getAllByRole("radio")).toHaveLength(1);
	});

	it("Cancel and Escape cancel", async () => {
		const { onCancel, onMove } = renderFor();

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		pressEscapeIn(dialog());

		expect(onCancel).toHaveBeenCalledTimes(2);
		expect(onMove).not.toHaveBeenCalled();
	});

	it("starts from the current place again for the next situation", async () => {
		const { rerender } = renderFor();
		await fireEvent.click(screen.getByRole("radio", { name: /Breakouts/ }));

		await rerender({ situation: summaryOf({ id: "s2", title: "Powerplay", folderId: "f2" }) });

		expect(screen.getByRole("radio", { name: /Set pieces/ })).toBeChecked();
	});

	it("keeps its 44 px targets as labels around the radios", () => {
		renderFor();

		for (const radio of screen.getAllByRole("radio")) {
			expect(radio.closest("label")).toHaveClass("place");
		}
	});
});
