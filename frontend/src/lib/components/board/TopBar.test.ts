import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/svelte";
import TopBar from "./TopBar.svelte";
import { theme } from "$lib/theme";
import { get } from "svelte/store";

describe("TopBar", () => {
	beforeEach(() => {
		theme.set("light");
	});

	it("renders the given title", () => {
		render(TopBar, { props: { title: "My Situation", onExport: vi.fn(), onLoadFile: vi.fn() } });

		expect(screen.getByText("My Situation")).toBeInTheDocument();
	});

	it("clicking Export calls onExport", async () => {
		const onExport = vi.fn();
		render(TopBar, { props: { title: "Board", onExport, onLoadFile: vi.fn() } });

		await fireEvent.click(screen.getByRole("button", { name: /export/i }));

		expect(onExport).toHaveBeenCalledOnce();
	});

	it("clicking the theme toggle flips the shared theme store", async () => {
		render(TopBar, { props: { title: "Board", onExport: vi.fn(), onLoadFile: vi.fn() } });

		await fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

		expect(get(theme)).toBe("dark");
	});
});
