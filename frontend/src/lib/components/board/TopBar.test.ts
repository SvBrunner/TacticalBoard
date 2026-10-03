import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/svelte";
import TopBar from "./TopBar.svelte";
import { theme } from "$lib/theme";
import { get } from "svelte/store";

function props(overrides: Record<string, unknown> = {}) {
	return {
		title: "Board",
		onExport: vi.fn(),
		onLoadFile: vi.fn(),
		canUndo: false,
		canRedo: false,
		onUndo: vi.fn(),
		onRedo: vi.fn(),
		...overrides,
	};
}

describe("TopBar", () => {
	beforeEach(() => {
		theme.set("light");
	});

	it("renders the given title", () => {
		render(TopBar, { props: props({ title: "My Situation" }) });

		expect(screen.getByText("My Situation")).toBeInTheDocument();
	});

	it("clicking Export calls onExport", async () => {
		const onExport = vi.fn();
		render(TopBar, { props: props({ onExport }) });

		await fireEvent.click(screen.getByRole("button", { name: /export/i }));

		expect(onExport).toHaveBeenCalledOnce();
	});

	it("clicking the theme toggle flips the shared theme store", async () => {
		render(TopBar, { props: props() });

		await fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

		expect(get(theme)).toBe("dark");
	});

	describe("history controls", () => {
		it("groups Undo and Redo in a group named History", () => {
			render(TopBar, { props: props() });

			const group = screen.getByRole("group", { name: "History" });
			const buttons = within(group).getAllByRole("button");
			expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Undo", "Redo"]);
		});

		it("shows the keyboard shortcuts as titles", () => {
			render(TopBar, { props: props() });

			expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute("title", "Undo (Ctrl+Z)");
			expect(screen.getByRole("button", { name: "Redo" })).toHaveAttribute("title", "Redo (Ctrl+Shift+Z)");
		});

		it("disables both buttons when nothing can be undone or redone", () => {
			render(TopBar, { props: props() });

			expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
			expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
		});

		it.each([
			[true, false],
			[false, true],
			[true, true],
		])("enables Undo=%s / Redo=%s according to canUndo/canRedo", (canUndo, canRedo) => {
			render(TopBar, { props: props({ canUndo, canRedo }) });

			expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", !canUndo);
			expect(screen.getByRole("button", { name: "Redo" })).toHaveProperty("disabled", !canRedo);
		});

		it("clicking Undo calls onUndo only", async () => {
			const onUndo = vi.fn();
			const onRedo = vi.fn();
			render(TopBar, { props: props({ canUndo: true, canRedo: true, onUndo, onRedo }) });

			await fireEvent.click(screen.getByRole("button", { name: "Undo" }));

			expect(onUndo).toHaveBeenCalledOnce();
			expect(onRedo).not.toHaveBeenCalled();
		});

		it("clicking Redo calls onRedo only", async () => {
			const onUndo = vi.fn();
			const onRedo = vi.fn();
			render(TopBar, { props: props({ canUndo: true, canRedo: true, onUndo, onRedo }) });

			await fireEvent.click(screen.getByRole("button", { name: "Redo" }));

			expect(onRedo).toHaveBeenCalledOnce();
			expect(onUndo).not.toHaveBeenCalled();
		});

		it("clicking disabled buttons does nothing", async () => {
			const onUndo = vi.fn();
			const onRedo = vi.fn();
			render(TopBar, { props: props({ onUndo, onRedo }) });

			await fireEvent.click(screen.getByRole("button", { name: "Undo" }));
			await fireEvent.click(screen.getByRole("button", { name: "Redo" }));

			expect(onUndo).not.toHaveBeenCalled();
			expect(onRedo).not.toHaveBeenCalled();
		});

		it("reflects updated canUndo/canRedo props", async () => {
			const { rerender } = render(TopBar, { props: props() });

			await rerender(props({ canUndo: true }));

			expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
			expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
		});
	});
});
