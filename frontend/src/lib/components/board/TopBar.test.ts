import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/svelte";
import TopBar from "./TopBar.svelte";
import { theme } from "$lib/theme";
import { get } from "svelte/store";

function props(overrides: Record<string, unknown> = {}) {
	return {
		title: "Board",
		onHome: vi.fn(),
		onNew: vi.fn(),
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

	describe("semantics", () => {
		it("is the banner landmark with the title as the page's h1", () => {
			render(TopBar, { props: props({ title: "My Situation" }) });

			const banner = screen.getByRole("banner");
			expect(within(banner).getByRole("heading", { level: 1, name: "My Situation" })).toBeInTheDocument();
		});

		it("gives every button an accessible name (also when shown icon-only on phones)", () => {
			render(TopBar, { props: props() });

			for (const name of ["Undo", "Redo", "New", "Load", "Export JSON", "Toggle theme"]) {
				expect(screen.getByRole("button", { name })).toBeInTheDocument();
			}
		});

		it("hides decorative icons from assistive technology", () => {
			const { container } = render(TopBar, { props: props() });

			for (const svg of container.querySelectorAll("svg")) {
				expect(svg.closest("[aria-hidden='true']")).not.toBeNull();
			}
		});

		it("uses type=button so nothing submits a form", () => {
			render(TopBar, { props: props() });

			for (const button of screen.getAllByRole("button")) {
				expect(button).toHaveAttribute("type", "button");
			}
		});
	});

	it("clicking New calls onNew only", async () => {
		const onNew = vi.fn();
		const onLoadFile = vi.fn();
		const onExport = vi.fn();
		render(TopBar, { props: props({ onNew, onLoadFile, onExport }) });

		await fireEvent.click(screen.getByRole("button", { name: "New" }));

		expect(onNew).toHaveBeenCalledOnce();
		expect(onLoadFile).not.toHaveBeenCalled();
		expect(onExport).not.toHaveBeenCalled();
	});

	it("the New button explains itself as 'New situation'", () => {
		render(TopBar, { props: props() });

		expect(screen.getByRole("button", { name: "New" })).toHaveAttribute("title", "New situation");
	});

	it("clicking Load opens the file picker", async () => {
		const { container } = render(TopBar, { props: props() });
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		const click = vi.spyOn(input, "click");

		await fireEvent.click(screen.getByRole("button", { name: "Load" }));

		expect(click).toHaveBeenCalledOnce();
	});

	it("choosing a file calls onLoadFile and resets the input", async () => {
		const onLoadFile = vi.fn();
		const { container } = render(TopBar, { props: props({ onLoadFile }) });
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		const file = new File(["{}"], "s.situation.json", { type: "application/json" });
		Object.defineProperty(input, "files", { value: [file], configurable: true });

		await fireEvent.change(input);

		expect(onLoadFile).toHaveBeenCalledWith(file);
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

	describe("badge (back to the start page)", () => {
		it("is a link to the start page named Start page", () => {
			render(TopBar, { props: props() });

			const link = within(screen.getByRole("banner")).getByRole("link", { name: "Start page" });
			expect(link).toHaveAttribute("href", "/");
		});

		it("a click goes through onHome instead of following the link", async () => {
			const onHome = vi.fn();
			render(TopBar, { props: props({ onHome }) });

			const notPrevented = await fireEvent.click(screen.getByRole("link", { name: "Start page" }));

			expect(onHome).toHaveBeenCalledOnce();
			expect(notPrevented).toBe(false);
		});

		it.each([["ctrlKey"], ["metaKey"], ["shiftKey"], ["altKey"]])(
			"a click with %s is left to the browser (e.g. open in a new tab)",
			async (modifier) => {
				const onHome = vi.fn();
				render(TopBar, { props: props({ onHome }) });
				const link = screen.getByRole("link", { name: "Start page" });
				link.addEventListener("click", (event) => event.preventDefault()); // jsdom can't navigate

				await fireEvent.click(link, { [modifier]: true });

				expect(onHome).not.toHaveBeenCalled();
			},
		);
	});
});
