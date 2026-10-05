import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { i18n } from "$lib/i18n";
import type { FolderListState } from "$lib/storage/FolderList";
import SavedFolders from "./SavedFolders.svelte";

function renderWith(list: FolderListState) {
	const onRetry = vi.fn();
	const view = render(SavedFolders, { props: { list, onRetry } });
	return { onRetry, ...view };
}

describe("SavedFolders", () => {
	afterEach(() => {
		cleanup();
		i18n.select("en");
	});

	it("says it is loading", () => {
		renderWith({ status: "loading" });

		expect(screen.getByRole("status")).toHaveTextContent("Loading folders…");
	});

	it("shows a failure with Try again", async () => {
		const { onRetry } = renderWith({ status: "failed", message: () => "The server is not reachable." });

		expect(screen.getByRole("alert")).toHaveTextContent("The server is not reachable.");
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("has an empty state", () => {
		renderWith({ status: "loaded", folders: [] });

		expect(screen.getByText("No folders yet.")).toBeInTheDocument();
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("lists the folders as links to their pages, in the given order", () => {
		const { container } = renderWith({
			status: "loaded",
			folders: [
				{ id: "f1", name: "Breakouts", createdAt: "", updatedAt: "", area: { kind: "personal", id: "u1" }, canWrite: true, situationCount: 0 },
				{ id: "f/2", name: "Set pieces", createdAt: "", updatedAt: "", area: { kind: "personal", id: "u1" }, canWrite: true, situationCount: 3 },
			],
		});

		const links = within(screen.getByRole("list")).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["/folders/f1", "/folders/f%2F2"]);
		expect(links[0]).toHaveAccessibleName("Breakouts 0 situations");
		for (const svg of container.querySelectorAll("svg")) {
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});

	it("shows the number of situations in each folder, in the UI language with its plural form", async () => {
		renderWith({
			status: "loaded",
			folders: [
				{ id: "f1", name: "Breakouts", createdAt: "", updatedAt: "", area: { kind: "personal", id: "u1" }, canWrite: true, situationCount: 1 },
				{ id: "f2", name: "Set pieces", createdAt: "", updatedAt: "", area: { kind: "personal", id: "u1" }, canWrite: true, situationCount: 2 },
			],
		});

		const [one, two] = within(screen.getByRole("list")).getAllByRole("link");
		expect(within(one).getByText("Breakouts")).toBeInTheDocument();
		expect(within(one).getByText("1 situation")).toBeInTheDocument();
		expect(within(two).getByText("2 situations")).toBeInTheDocument();

		i18n.select("de");
		await tick();

		expect(within(one).getByText("1 Situation")).toBeInTheDocument();
		expect(within(two).getByText("2 Situationen")).toBeInTheDocument();
	});
});
