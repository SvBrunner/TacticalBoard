import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import type { FolderListState } from "$lib/storage/FolderList";
import SavedFolders from "./SavedFolders.svelte";

function renderWith(list: FolderListState) {
	const onRetry = vi.fn();
	const view = render(SavedFolders, { props: { list, onRetry } });
	return { onRetry, ...view };
}

describe("SavedFolders", () => {
	afterEach(() => cleanup());

	it("says it is loading", () => {
		renderWith({ status: "loading" });

		expect(screen.getByRole("status")).toHaveTextContent("Loading folders…");
	});

	it("shows a failure with Try again", async () => {
		const { onRetry } = renderWith({ status: "failed", message: "The server is not reachable." });

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
				{ id: "f1", name: "Breakouts", createdAt: "", updatedAt: "" },
				{ id: "f/2", name: "Set pieces", createdAt: "", updatedAt: "" },
			],
		});

		const links = within(screen.getByRole("list")).getAllByRole("link");
		expect(links.map((link) => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([
			["Breakouts", "/folders/f1"],
			["Set pieces", "/folders/f%2F2"],
		]);
		for (const svg of container.querySelectorAll("svg")) {
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});
});
