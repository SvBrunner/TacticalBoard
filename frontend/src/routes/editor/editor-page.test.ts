import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import Konva from "konva";
import { notifications } from "$lib/debug/Notifications";
import { situationEditor } from "$lib/editor/SituationEditor";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";
import type { Shape } from "konva/lib/Shape";
import type { PointElement } from "$lib/model/elements/PointElement";
import EditorPage from "./+page.svelte";
import { goto } from "$app/navigation";
import { ArrowElement } from "$lib/model/elements/ArrowElement";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => undefined) }));

/** Lets pending promise continuations and the resulting DOM updates run. */
async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

const messages = () => get(notifications.notifications).map((n) => n.message);

describe("editor page", () => {
	let restoreDialog: () => void;
	let restoreCanvas: () => void;

	beforeEach(() => {
		restoreDialog = installDialogPolyfill();
		restoreCanvas = installFakeCanvasContext();
		FakeResizeObserver.reset();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
		notifications.clear();
		vi.mocked(goto).mockClear();
		situationEditor.createNew({ title: "Breakout", fieldType: "full" });
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		restoreCanvas();
		restoreDialog();
	});

	it("shows the situation title, the tools and the field", () => {
		render(EditorPage);

		expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1, name: "Breakout" })).toBeInTheDocument();
		expect(screen.getByRole("complementary", { name: "Tools" })).toBeInTheDocument();
		expect(within(screen.getByRole("main")).getByRole("region", { name: "Field" })).toBeInTheDocument();
	});

	it("shows a half-field situation rotated to portrait", async () => {
		situationEditor.createNew({ title: "Half", fieldType: "half" });
		render(EditorPage);

		FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500);
		await tick();

		const stage = Konva.stages[Konva.stages.length - 1];
		expect(stage.rotation()).toBe(90);
		expect(stage.width()).toBe(500);
	});

	describe("New", () => {
		it("opens the New situation dialog right away when nothing is unsaved", async () => {
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			expect(screen.getByRole("dialog", { name: "New situation" })).toHaveAttribute("open");
		});

		it("asks 'Discard changes?' first when there are unsaved changes", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
			expect(document.querySelector<HTMLDialogElement>("dialog:not([role])")?.open).toBe(false);
		});

		it("discarding and creating replaces the situation", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);
			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
			await settle();
			await fireEvent.click(screen.getByRole("radio", { name: /half/i }));
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));
			await tick();

			expect(situationEditor.current()).toMatchObject({ title: "Untitled Situation", fieldType: "half" });
			expect(get(situationEditor.elements)).toEqual([]);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Untitled Situation");
		});

		it("keyboard shortcuts don't reach the board while a modal dialog has focus", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);
			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			await fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "z", ctrlKey: true });

			expect(get(situationEditor.elements)).toHaveLength(1);
		});
	});

	describe("undo/redo", () => {
		it("undoes via the keyboard outside dialogs and logs it", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });

			expect(get(situationEditor.elements)).toEqual([]);
			expect(messages()).toContain("Undo: Add Player");
		});

		it("logs nothing when there is nothing to undo or redo", async () => {
			render(EditorPage);

			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });

			expect(messages().filter((m) => /undo|redo/i.test(m))).toEqual([]);
		});
	});

	describe("element popover", () => {
		async function openPopoverFor(id: string) {
			render(EditorPage);
			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500);
			await tick();
			const stage = Konva.stages[Konva.stages.length - 1];
			const shape = stage.findOne(`#${id}`)!;
			shape.fire("pointerclick", { evt: { button: 0, shiftKey: false, pointerType: "touch", preventDefault: () => {} } }, true);
			await tick();
			return screen.getByRole("dialog", { name: "Edit marker" });
		}

		const labelOf = (id: string) => (get(situationEditor.elements).find((e) => e.id === id) as PointElement).label;
		const selectedStroke = (id: string) => (Konva.stages.at(-1)!.findOne(`#${id}`) as Shape).strokeWidth();

		it("Close closes the popover and clears the selection", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);
			expect(selectedStroke(id)).toBeGreaterThan(0);

			await fireEvent.click(screen.getByRole("button", { name: "Close" }));

			expect(screen.queryByRole("dialog", { name: "Edit marker" })).not.toBeInTheDocument();
			expect(selectedStroke(id)).toBe(0);
		});

		it("stays open when the tool changes", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);

			await fireEvent.click(within(screen.getByRole("complementary", { name: "Tools" })).getByRole("button", { name: "Ball" }));

			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBeInTheDocument();
		});

		it("stays open on a resize and moves with the element", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			const dialog = await openPopoverFor(id);
			const before = dialog.style.getPropertyValue("--anchor-x");

			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 400, 600);
			await tick();

			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBe(dialog);
			expect(dialog.style.getPropertyValue("--anchor-x")).not.toBe(before);
		});

		it("sets a position label on the player and draws it", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);

			await fireEvent.click(screen.getByRole("radio", { name: /^C\b/ }));
			await tick();

			expect(labelOf(id)).toBe("C");
			expect((Konva.stages.at(-1)!.findOne(".ElementLabel") as Konva.Text).text()).toBe("C");
		});

		it("a typed label is one undo step", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);
			const input = screen.getByRole("textbox", { name: "Custom" });

			input.focus();
			await fireEvent.input(input, { target: { value: "1" } });
			await fireEvent.input(input, { target: { value: "10" } });
			await fireEvent.blur(input);
			expect(labelOf(id)).toBe("10");

			situationEditor.undo();
			expect(labelOf(id)).toBe("");
			expect(get(situationEditor.elements)).toHaveLength(1);
		});

		it.each([["Delete"], ["Backspace"]])("%s inside the label field does not delete the element", async (key) => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);
			const input = screen.getByRole("textbox", { name: "Custom" });

			input.focus();
			await fireEvent.keyDown(input, { key });

			expect(get(situationEditor.elements).map((e) => e.id)).toEqual([id]);
			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBeInTheDocument();
		});

		it("Delete outside text fields still deletes the selected element", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);

			await fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), { key: "Delete" });

			expect(get(situationEditor.elements)).toEqual([]);
		});
	});

	describe("frames", () => {
		const strip = () => screen.getByRole("navigation", { name: "Frames" });
		const frameIds = () => situationEditor.current().frames.map((frame) => frame.id);

		async function openPopoverFor(id: string) {
			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500);
			await tick();
			const shape = Konva.stages[Konva.stages.length - 1].findOne(`#${id}`)!;
			shape.fire("pointerclick", { evt: { button: 0, shiftKey: false, pointerType: "touch", preventDefault: () => {} } }, true);
			await tick();
		}

		it("shows the frame strip with the first frame active", () => {
			render(EditorPage);

			expect(within(strip()).getByRole("button", { name: "Frame 1" })).toHaveAttribute("aria-current", "step");
			expect(within(strip()).getByRole("button", { name: "Delete frame" })).toBeDisabled();
		});

		it("Add frame adds a copy after the current frame and switches to it", async () => {
			situationEditor.addElement(500, 250, "red", "Player");
			render(EditorPage);

			await fireEvent.click(within(strip()).getByRole("button", { name: "Add frame" }));

			expect(frameIds()).toHaveLength(2);
			expect(within(strip()).getByRole("button", { name: "Frame 2" })).toHaveAttribute("aria-current", "step");
			expect(get(situationEditor.elements)).toHaveLength(1);
			expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
		});

		it("switching frames closes the popover and clears the selection", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			situationEditor.addFrame();
			situationEditor.selectFrame(frameIds()[0]);
			render(EditorPage);
			await openPopoverFor(id);
			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBeInTheDocument();

			await fireEvent.click(within(strip()).getByRole("button", { name: "Frame 2" }));

			expect(get(situationEditor.activeFrame).id).toBe(frameIds()[1]);
			expect(screen.queryByRole("dialog", { name: "Edit marker" })).not.toBeInTheDocument();
			expect((Konva.stages.at(-1)!.findOne(`#${id}`) as Shape).strokeWidth()).toBe(0);
		});

		it("Delete frame asks for confirmation; Delete removes the frame", async () => {
			situationEditor.addFrame();
			render(EditorPage);

			await fireEvent.click(within(strip()).getByRole("button", { name: "Delete frame" }));
			await settle();
			expect(screen.getByRole("alertdialog", { name: "Delete frame?" })).toHaveAttribute("open");

			await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
			await settle();

			expect(frameIds()).toHaveLength(1);
			expect(within(strip()).getAllByRole("listitem")).toHaveLength(1);
			expect(within(strip()).getByRole("button", { name: "Frame 1" })).toHaveAttribute("aria-current", "step");
		});

		it("cancelling the confirmation keeps the frame", async () => {
			situationEditor.addFrame();
			render(EditorPage);

			await fireEvent.click(within(strip()).getByRole("button", { name: "Delete frame" }));
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			await settle();

			expect(frameIds()).toHaveLength(2);
		});

		it("Move frame left reorders and keeps the moved frame active", async () => {
			situationEditor.addFrame();
			const moved = get(situationEditor.activeFrame).id;
			render(EditorPage);

			await fireEvent.click(within(strip()).getByRole("button", { name: "Move frame left" }));

			expect(frameIds()[0]).toBe(moved);
			expect(within(strip()).getByRole("button", { name: "Frame 1" })).toHaveAttribute("aria-current", "step");
		});

		it("the thumbnails show the frames' elements", () => {
			situationEditor.addElement(500, 250, "red", "Player");
			render(EditorPage);

			const thumbnail = within(strip()).getByRole("button", { name: "Frame 1" }).querySelector("svg")!;
			expect(thumbnail.querySelectorAll("[data-element-id]")).toHaveLength(1);
		});
	});

	describe("details panel", () => {
		const panel = () => screen.getByRole("complementary", { name: "Details" });

		it("edits the title; the header and document title follow; not undoable", async () => {
			render(EditorPage);
			const input = within(panel()).getByRole("textbox", { name: "Title" });

			await fireEvent.input(input, { target: { value: "Powerplay" } });

			expect(situationEditor.current().title).toBe("Powerplay");
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Powerplay");
			expect(document.title).toContain("Powerplay");
			expect(situationEditor.isDirty()).toBe(true);
			expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
		});

		it("a blank title shows the default title in the header", async () => {
			render(EditorPage);

			await fireEvent.input(within(panel()).getByRole("textbox", { name: "Title" }), { target: { value: "" } });

			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Untitled Situation");
		});

		it("edits the situation description", async () => {
			render(EditorPage);

			await fireEvent.input(within(panel()).getByRole("textbox", { name: "Description" }), { target: { value: "# Notes" } });

			expect(situationEditor.current().description).toBe("# Notes");
		});

		it("the frame description is one undo step per edit session", async () => {
			render(EditorPage);
			const field = within(panel()).getByRole("textbox", { name: "Frame 1 description" }) as HTMLTextAreaElement;

			field.focus();
			await fireEvent.input(field, { target: { value: "P" } });
			await fireEvent.input(field, { target: { value: "Press" } });
			await fireEvent.blur(field);
			expect(situationEditor.currentFrame().description).toBe("Press");

			await fireEvent.click(screen.getByRole("button", { name: "Undo" }));

			expect(situationEditor.currentFrame().description).toBe("");
			expect(field.value).toBe("");
		});

		it("the frame description follows the active frame", async () => {
			situationEditor.changeFrameDescription("one");
			situationEditor.addFrame();
			situationEditor.changeFrameDescription("two");
			render(EditorPage);

			await fireEvent.click(within(screen.getByRole("navigation", { name: "Frames" })).getByRole("button", { name: "Frame 1" }));

			const field = within(panel()).getByRole("textbox", { name: "Frame 1 description" }) as HTMLTextAreaElement;
			expect(field.value).toBe("one");
		});

		it("Ctrl+Z inside a text field is left to the browser", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			for (const name of ["Title", "Description", "Frame 1 description"]) {
				await fireEvent.keyDown(within(panel()).getByRole("textbox", { name }), { key: "z", ctrlKey: true });
			}

			expect(get(situationEditor.elements)).toHaveLength(1);
		});

		it.each([["Delete"], ["Backspace"]])("%s in the title field does not delete the selected element", async (key) => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			render(EditorPage);
			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500);
			await tick();
			Konva.stages.at(-1)!.findOne(`#${id}`)!.fire("pointerclick", { evt: { button: 0, shiftKey: false, pointerType: "mouse", preventDefault: () => {} } }, true);
			await tick();

			await fireEvent.keyDown(within(panel()).getByRole("textbox", { name: "Title" }), { key });
			await fireEvent.keyDown(within(panel()).getByRole("textbox", { name: "Frame 1 description" }), { key });

			expect(get(situationEditor.elements).map((element) => element.id)).toEqual([id]);
		});
	});

	it("Export downloads the situation and clears the unsaved-changes flag", async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		situationEditor.addElement(1, 1, "red", "Player");
		render(EditorPage);

		await fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

		expect(click).toHaveBeenCalledOnce();
		expect(situationEditor.isDirty()).toBe(false);
		click.mockRestore();
	});

	describe("badge: back to the start page", () => {
		const badge = () => within(screen.getByRole("banner")).getByRole("link", { name: "Start page" });

		it("navigates right away when nothing is unsaved and closes the situation", async () => {
			render(EditorPage);

			await fireEvent.click(badge());
			await settle();

			expect(goto).toHaveBeenCalledWith("/");
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
			expect(situationEditor.isSituationOpen()).toBe(false);
		});

		it("asks 'Discard changes?' first when there are unsaved changes; Discard leaves", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			await fireEvent.click(badge());
			await settle();
			expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
			expect(goto).not.toHaveBeenCalled();

			await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
			await settle();

			expect(goto).toHaveBeenCalledWith("/");
			expect(situationEditor.isDirty()).toBe(false);
			expect(situationEditor.isSituationOpen()).toBe(false);
		});

		it("Cancel stays in the editor with the unsaved changes", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			await fireEvent.click(badge());
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			await settle();

			expect(goto).not.toHaveBeenCalled();
			expect(situationEditor.isDirty()).toBe(true);
			expect(get(situationEditor.elements)).toHaveLength(1);
		});
	});

	describe("arrows", () => {
		function pointer(clientX: number, clientY: number) {
			return { button: 0, shiftKey: false, pointerType: "touch", pointerId: 1, clientX, clientY, preventDefault: () => {} };
		}

		function windowPointer(type: string, clientX: number, clientY: number) {
			const event = new MouseEvent(type, { clientX, clientY });
			Object.defineProperty(event, "pointerId", { value: 1 });
			window.dispatchEvent(event);
		}

		async function showBoard() {
			render(EditorPage);
			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500); // scale 0.5
			await tick();
			return Konva.stages[Konva.stages.length - 1];
		}

		async function selectTool(name: string) {
			await fireEvent.click(within(screen.getByRole("complementary", { name: "Tools" })).getByRole("button", { name }));
		}

		it("draws a black pass by dragging with the Pass tool; players can't be dragged meanwhile", async () => {
			const player = situationEditor.addElement(500, 250, "red", "Player");
			const stage = await showBoard();
			await selectTool("Pass");

			expect(stage.findOne(`#${player}`)!.draggable()).toBe(false);
			stage.findOne(`#${player}`)!.fire("pointerdown", { evt: pointer(250, 125) }, true);
			windowPointer("pointermove", 400, 125);
			windowPointer("pointerup", 450, 200);
			await tick();

			const arrow = get(situationEditor.elements).find((element) => element instanceof ArrowElement) as ArrowElement;
			expect(arrow).toMatchObject({ type: "Pass", start: { x: 500, y: 250 }, end: { x: 900, y: 400 } });
			expect(arrow.color).toBe("oklch(15% 0 0)");
			expect(stage.find(".Arrow")).toHaveLength(1);
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		it("Escape and a tool change drop a pending start point", async () => {
			const stage = await showBoard();
			await selectTool("Shot");

			stage.fire("pointerdown", { evt: pointer(100, 100) });
			windowPointer("pointerup", 100, 100);
			await tick();
			expect(stage.find(".ArrowDraftStart")).toHaveLength(1);

			await fireEvent.keyDown(document.body, { key: "Escape" });
			await tick();
			expect(stage.find(".ArrowDraftStart")).toHaveLength(0);

			stage.fire("pointerdown", { evt: pointer(100, 100) });
			windowPointer("pointerup", 100, 100);
			await selectTool("Run");
			await tick();
			expect(stage.find(".ArrowDraftStart")).toHaveLength(0);
		});

		it("the arrow popover changes type and color, straightens and deletes; each change is one undo step", async () => {
			const id = situationEditor.addArrow({ x: 200, y: 200 }, { x: 800, y: 200 }, "oklch(15% 0 0)", "Pass");
			situationEditor.addBend(id, 0, { x: 500, y: 400 });
			const stage = await showBoard();

			stage.findOne(`#${id}`)!.fire("pointerclick", { evt: pointer(250, 100) }, true);
			await tick();
			const dialog = screen.getByRole("dialog", { name: "Edit arrow" });
			expect(stage.find(".ArrowHandle")).toHaveLength(5);

			await fireEvent.click(within(dialog).getByRole("button", { name: "Run" }));
			await fireEvent.click(within(dialog).getByRole("button", { name: "Team B" }));
			await fireEvent.click(within(dialog).getByRole("button", { name: "Straighten" }));
			await tick();

			const arrow = () => get(situationEditor.elements)[0] as ArrowElement;
			expect(arrow()).toMatchObject({ type: "Run", color: "oklch(64% 0.16 32)", bends: [] });
			expect(within(dialog).queryByRole("button", { name: "Straighten" })).not.toBeInTheDocument();

			situationEditor.undo();
			expect(arrow().bends).toHaveLength(1);

			stage.findOne(`#${id}`)!.fire("pointerclick", { evt: pointer(250, 100) }, true);
			await tick();
			await fireEvent.click(screen.getByRole("button", { name: /delete arrow/i }));
			expect(get(situationEditor.elements)).toEqual([]);
		});

		it("a tapped bend handle can be removed from the popover", async () => {
			const id = situationEditor.addArrow({ x: 200, y: 200 }, { x: 800, y: 200 }, "black", "Pass");
			situationEditor.addBend(id, 0, { x: 400, y: 400 });
			situationEditor.addBend(id, 1, { x: 600, y: 400 });
			const stage = await showBoard();
			stage.findOne(`#${id}`)!.fire("pointerclick", { evt: pointer(250, 100) }, true);
			await tick();

			const bend = stage.find(".ArrowHandle").find((node) => node.getAttr("handleKey") === "bend-1")!;
			bend.fire("pointerclick", { evt: pointer(300, 200) }, true);
			await tick();
			await fireEvent.click(screen.getByRole("button", { name: "Remove bend" }));
			await tick();

			expect((get(situationEditor.elements)[0] as ArrowElement).bends).toEqual([{ x: 400, y: 400 }]);
			expect(screen.queryByRole("button", { name: "Remove bend" })).not.toBeInTheDocument();
			expect(get(situationEditor.history).undoLabel).toBe("Remove bend from Pass");
		});

		it("Edit shape hides the popover and keeps the handles; Close clears them", async () => {
			const id = situationEditor.addArrow({ x: 200, y: 200 }, { x: 800, y: 200 }, "black", "Pass");
			const stage = await showBoard();
			stage.findOne(`#${id}`)!.fire("pointerclick", { evt: pointer(250, 100) }, true);
			await tick();

			await fireEvent.click(screen.getByRole("button", { name: "Edit shape" }));
			await tick();

			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			expect(stage.find(".ArrowHandle")).toHaveLength(3);

			stage.findOne(`#${id}`)!.fire("pointerclick", { evt: pointer(250, 100) }, true);
			await tick();
			await fireEvent.click(screen.getByRole("button", { name: "Close" }));
			await tick();
			expect(stage.find(".ArrowHandle")).toHaveLength(0);
		});

		it("markers get a color in their popover too", async () => {
			const id = situationEditor.addElement(500, 250, "grey", "Triangle");
			const stage = await showBoard();

			stage.findOne(`#${id}`)!.fire("pointerclick", { evt: pointer(250, 125) }, true);
			await tick();
			await fireEvent.click(within(screen.getByRole("group", { name: "Color" })).getByRole("button", { name: "Team C" }));

			expect(get(situationEditor.elements)[0].color).toBe("oklch(64% 0.14 150)");
		});
	});
});
