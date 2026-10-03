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
		onExportJson: vi.fn(),
		onExportAnimation: vi.fn(),
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

			for (const name of ["Undo", "Redo", "New", "Load", "Export", "Toggle theme"]) {
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
		const onExportJson = vi.fn();
		const onExportAnimation = vi.fn();
		render(TopBar, { props: props({ onNew, onLoadFile, onExportJson, onExportAnimation }) });

		await fireEvent.click(screen.getByRole("button", { name: "New" }));

		expect(onNew).toHaveBeenCalledOnce();
		expect(onLoadFile).not.toHaveBeenCalled();
		expect(onExportJson).not.toHaveBeenCalled();
		expect(onExportAnimation).not.toHaveBeenCalled();
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

	describe("export choice", () => {
		const toggle = () => screen.getByRole("button", { name: "Export" });
		const choices = () => document.querySelector<HTMLUListElement>("ul[aria-label=\"Export as\"]")!;

		it("is a disclosure button controlling a hidden list of choices", () => {
			render(TopBar, { props: props() });

			expect(toggle()).toHaveAttribute("aria-expanded", "false");
			expect(toggle()).toHaveAttribute("aria-controls", choices().id);
			expect(choices().tagName).toBe("UL");
			expect(choices()).not.toBeVisible();
		});

		it("clicking Export shows the two choices without exporting yet", async () => {
			const onExportJson = vi.fn();
			const onExportAnimation = vi.fn();
			render(TopBar, { props: props({ onExportJson, onExportAnimation }) });

			await fireEvent.click(toggle());

			expect(toggle()).toHaveAttribute("aria-expanded", "true");
			expect(screen.getByRole("list", { name: "Export as" })).toBe(choices());
			expect(within(choices()).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
				"Situation file (JSON)",
				"Animated GIF",
			]);
			expect(within(choices()).getAllByRole("listitem")).toHaveLength(2);
			expect(onExportJson).not.toHaveBeenCalled();
			expect(onExportAnimation).not.toHaveBeenCalled();
		});

		it("clicking Export again hides the choices", async () => {
			render(TopBar, { props: props() });

			await fireEvent.click(toggle());
			await fireEvent.click(toggle());

			expect(toggle()).toHaveAttribute("aria-expanded", "false");
			expect(choices()).not.toBeVisible();
		});

		it("'Situation file (JSON)' calls onExportJson only, then closes the choices and focuses Export", async () => {
			const onExportJson = vi.fn();
			const onExportAnimation = vi.fn();
			render(TopBar, { props: props({ onExportJson, onExportAnimation }) });
			await fireEvent.click(toggle());

			await fireEvent.click(screen.getByRole("button", { name: "Situation file (JSON)" }));

			expect(onExportJson).toHaveBeenCalledOnce();
			expect(onExportAnimation).not.toHaveBeenCalled();
			expect(toggle()).toHaveAttribute("aria-expanded", "false");
			expect(document.activeElement).toBe(toggle());
		});

		it("'Animated GIF' calls onExportAnimation only", async () => {
			const onExportJson = vi.fn();
			const onExportAnimation = vi.fn();
			render(TopBar, { props: props({ onExportJson, onExportAnimation }) });
			await fireEvent.click(toggle());

			await fireEvent.click(screen.getByRole("button", { name: "Animated GIF" }));

			expect(onExportAnimation).toHaveBeenCalledOnce();
			expect(onExportJson).not.toHaveBeenCalled();
			expect(toggle()).toHaveAttribute("aria-expanded", "false");
		});

		it("Escape closes the choices and returns focus to Export, without reaching the page", async () => {
			const pageKeydown = vi.fn();
			window.addEventListener("keydown", pageKeydown);
			render(TopBar, { props: props() });
			await fireEvent.click(toggle());
			const json = screen.getByRole("button", { name: "Situation file (JSON)" });
			json.focus();

			await fireEvent.keyDown(json, { key: "Escape" });

			expect(toggle()).toHaveAttribute("aria-expanded", "false");
			expect(document.activeElement).toBe(toggle());
			expect(pageKeydown).not.toHaveBeenCalled();
			window.removeEventListener("keydown", pageKeydown);
		});

		it("a press outside closes the choices; a press inside doesn't", async () => {
			render(TopBar, { props: props() });
			await fireEvent.click(toggle());

			await fireEvent.pointerDown(screen.getByRole("button", { name: "Animated GIF" }));
			expect(toggle()).toHaveAttribute("aria-expanded", "true");

			await fireEvent.pointerDown(document.body);
			expect(toggle()).toHaveAttribute("aria-expanded", "false");
		});

		it("moving focus out of the menu closes the choices; moving within doesn't", async () => {
			render(TopBar, { props: props() });
			await fireEvent.click(toggle());
			const json = screen.getByRole("button", { name: "Situation file (JSON)" });
			const gif = screen.getByRole("button", { name: "Animated GIF" });

			await fireEvent.focusOut(json, { relatedTarget: gif });
			expect(toggle()).toHaveAttribute("aria-expanded", "true");

			await fireEvent.focusOut(gif, { relatedTarget: screen.getByRole("button", { name: "Toggle theme" }) });
			expect(toggle()).toHaveAttribute("aria-expanded", "false");
		});

		it("choices are buttons with type=button", async () => {
			render(TopBar, { props: props() });
			await fireEvent.click(toggle());

			for (const button of within(choices()).getAllByRole("button")) {
				expect(button).toHaveAttribute("type", "button");
			}
		});
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
