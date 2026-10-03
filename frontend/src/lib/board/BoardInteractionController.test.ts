import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
	BoardInteractionController,
	type BoardEditing,
	type ElementSelection,
	type PopoverControl,
	type ToolSource,
	type KeyInput,
} from "./BoardInteractionController";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { BoardViewport, type ScreenRect } from "./BoardViewport";
import type { Tool } from "./ToolState";

class FakeEditor implements BoardEditing {
	addElement = vi.fn((_x: number, _y: number, _color: string, _type: string) => "new-id");
	removeElement = vi.fn();
	moveElement = vi.fn();
	endGesture = vi.fn();
}

class FakeSelection implements ElementSelection {
	id: string | null = null;
	current() {
		return this.id;
	}
	select(id: string) {
		this.id = id;
	}
	clear() {
		this.id = null;
	}
}

class FakeTools implements ToolSource {
	constructor(
		public tool: Tool = "Player",
		public color = "team-a",
	) {}
	currentTool() {
		return this.tool;
	}
	currentPlayerColor() {
		return this.color;
	}
}

class FakePopover implements PopoverControl {
	anchor: ScreenRect | null = null;
	open(anchor: ScreenRect) {
		this.anchor = anchor;
	}
	close() {
		this.anchor = null;
	}
}

const anchor: ScreenRect = { x: 10, y: 20, width: 30, height: 30 };

function key(keyName: string, target: EventTarget | null = document.body) {
	return { key: keyName, target, preventDefault: vi.fn<() => void>() } satisfies KeyInput;
}

describe("BoardInteractionController", () => {
	let editor: FakeEditor;
	let selection: FakeSelection;
	let tools: FakeTools;
	let popover: FakePopover;
	let log: { notify: Mock<(message: string) => void> };
	let controller: BoardInteractionController;

	beforeEach(() => {
		editor = new FakeEditor();
		selection = new FakeSelection();
		tools = new FakeTools();
		popover = new FakePopover();
		log = { notify: vi.fn<(message: string) => void>() };
		controller = new BoardInteractionController({
			editor,
			selection,
			tools,
			popover,
			bounds: new BoardViewport(),
			neutralColor: "neutral",
			log,
		});
	});

	describe("tapping an element", () => {
		it("selects it and opens the popover at the anchor", () => {
			controller.tapElement("el-1", anchor);

			expect(selection.id).toBe("el-1");
			expect(popover.anchor).toEqual(anchor);
		});

		it("selects instead of placing while a placement tool is active", () => {
			tools.tool = "Ball";

			controller.tapElement("el-1", anchor, { shiftKey: false });

			expect(editor.addElement).not.toHaveBeenCalled();
			expect(selection.id).toBe("el-1");
		});

		it("works the same with the Move tool", () => {
			tools.tool = "Move";

			controller.tapElement("el-1", anchor);

			expect(selection.id).toBe("el-1");
			expect(popover.anchor).toEqual(anchor);
		});

		it("switches the selection and re-anchors the popover", () => {
			controller.tapElement("el-1", anchor);
			const other = { ...anchor, x: 99 };

			controller.tapElement("el-2", other);

			expect(selection.id).toBe("el-2");
			expect(popover.anchor).toEqual(other);
		});

		it("with Shift deletes it instead of selecting", () => {
			controller.tapElement("el-1", anchor, { shiftKey: true });

			expect(editor.removeElement).toHaveBeenCalledWith("el-1");
			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});

		it("with Shift on the selected element clears the selection and closes the popover", () => {
			controller.tapElement("el-1", anchor);

			controller.tapElement("el-1", anchor, { shiftKey: true });

			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});

		it("with Shift on another element keeps the current selection", () => {
			controller.tapElement("el-1", anchor);

			controller.tapElement("el-2", anchor, { shiftKey: true });

			expect(editor.removeElement).toHaveBeenCalledWith("el-2");
			expect(selection.id).toBe("el-1");
		});
	});

	describe("context menu (right-click / long-press)", () => {
		it("selects the element and opens the popover like a tap", () => {
			controller.contextMenu("el-1", anchor);

			expect(selection.id).toBe("el-1");
			expect(popover.anchor).toEqual(anchor);
			expect(editor.removeElement).not.toHaveBeenCalled();
		});
	});

	describe("tapping the empty field", () => {
		it("places a Player in the selected player color", () => {
			controller.tapField({ x: 100, y: 200 });

			expect(editor.addElement).toHaveBeenCalledWith(100, 200, "team-a", "Player");
		});

		it.each<[Tool]>([["Ball"], ["Rectangle"], ["Triangle"], ["Circle"]])("places a %s in the neutral color", (tool) => {
			tools.tool = tool;

			controller.tapField({ x: 5, y: 6 });

			expect(editor.addElement).toHaveBeenCalledWith(5, 6, "neutral", tool);
		});

		it("keeps the tool active and does not select the new element", () => {
			controller.tapField({ x: 1, y: 1 });
			controller.tapField({ x: 2, y: 2 });

			expect(editor.addElement).toHaveBeenCalledTimes(2);
			expect(selection.id).toBeNull();
		});

		it("clears the selection and closes the popover when placing", () => {
			controller.tapElement("el-1", anchor);

			controller.tapField({ x: 1, y: 1 });

			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});

		it("clamps the position onto the field", () => {
			controller.tapField({ x: -3, y: 1001 });

			expect(editor.addElement).toHaveBeenCalledWith(0, 1000, "team-a", "Player");
		});

		it("with Move places nothing and clears the selection and popover", () => {
			tools.tool = "Move";
			controller.tapElement("el-1", anchor);

			controller.tapField({ x: 1, y: 1 });

			expect(editor.addElement).not.toHaveBeenCalled();
			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});
	});

	describe("dragging", () => {
		it("dragStart closes the popover but keeps the selection", () => {
			controller.tapElement("el-1", anchor);

			controller.dragStart("el-1");

			expect(popover.anchor).toBeNull();
			expect(selection.id).toBe("el-1");
		});

		it("dragMove keeps the element on the field", () => {
			expect(controller.dragMove({ x: 2100, y: -50 })).toEqual({ x: 2000, y: 0 });
			expect(controller.dragMove({ x: 300, y: 400 })).toEqual({ x: 300, y: 400 });
		});

		it("dragEnd moves the element and ends the gesture (one undo step)", () => {
			controller.dragEnd("el-1", { x: 300, y: 400 });

			expect(editor.moveElement).toHaveBeenCalledWith("el-1", 300, 400);
			expect(editor.endGesture).toHaveBeenCalledOnce();
			expect(editor.moveElement.mock.invocationCallOrder[0]).toBeLessThan(editor.endGesture.mock.invocationCallOrder[0]);
		});

		it("dragEnd clamps the final position", () => {
			controller.dragEnd("el-1", { x: -1, y: 5000 });

			expect(editor.moveElement).toHaveBeenCalledWith("el-1", 0, 1000);
		});
	});

	describe("keyboard", () => {
		it("Escape clears the selection and closes the popover", () => {
			controller.tapElement("el-1", anchor);

			expect(controller.keyDown(key("Escape"))).toBe(true);

			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});

		it.each([["Delete"], ["Backspace"]])("%s deletes the selected element", (keyName) => {
			controller.tapElement("el-1", anchor);
			const event = key(keyName);

			expect(controller.keyDown(event)).toBe(true);

			expect(editor.removeElement).toHaveBeenCalledWith("el-1");
			expect(event.preventDefault).toHaveBeenCalled();
			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});

		it("Delete without a selection does nothing", () => {
			const event = key("Delete");

			expect(controller.keyDown(event)).toBe(false);

			expect(editor.removeElement).not.toHaveBeenCalled();
			expect(event.preventDefault).not.toHaveBeenCalled();
		});

		it.each([["input"], ["textarea"], ["select"]])("ignores keys typed into a %s", (tag) => {
			controller.tapElement("el-1", anchor);
			const field = document.createElement(tag);
			document.body.append(field);

			expect(controller.keyDown(key("Backspace", field))).toBe(false);
			expect(controller.keyDown(key("Escape", field))).toBe(false);

			expect(editor.removeElement).not.toHaveBeenCalled();
			expect(selection.id).toBe("el-1");
			field.remove();
		});

		it("ignores keys inside a contenteditable element", () => {
			controller.tapElement("el-1", anchor);
			const editable = document.createElement("div");
			editable.setAttribute("contenteditable", "true");
			const inner = document.createElement("span");
			editable.append(inner);
			document.body.append(editable);

			expect(controller.keyDown(key("Delete", inner))).toBe(false);

			expect(editor.removeElement).not.toHaveBeenCalled();
			editable.remove();
		});

		it("ignores keys during IME composition", () => {
			controller.tapElement("el-1", anchor);

			expect(controller.keyDown({ ...key("Backspace"), isComposing: true })).toBe(false);

			expect(editor.removeElement).not.toHaveBeenCalled();
		});

		it("ignores unrelated keys", () => {
			controller.tapElement("el-1", anchor);

			expect(controller.keyDown(key("a"))).toBe(false);

			expect(selection.id).toBe("el-1");
		});
	});

	it("logs actions to the debug log", () => {
		controller.tapField({ x: 1, y: 2 });

		expect(log.notify).toHaveBeenCalledWith("Added Player at (1, 2)");
	});

	it("works without a log", () => {
		const quiet = new BoardInteractionController({
			editor,
			selection,
			tools,
			popover,
			bounds: new BoardViewport(),
			neutralColor: "neutral",
		});

		expect(() => quiet.tapField({ x: 1, y: 2 })).not.toThrow();
	});

	describe("with a half-field viewport", () => {
		let half: BoardInteractionController;

		beforeEach(() => {
			half = new BoardInteractionController({
				editor,
				selection,
				tools,
				popover,
				bounds: new BoardViewport(FieldDimensions.FLOORBALL, "half"),
				neutralColor: "neutral",
			});
		});

		it("places in full-field coordinates inside the visible half", () => {
			half.tapField({ x: 1500, y: 400 });

			expect(editor.addElement).toHaveBeenCalledWith(1500, 400, "team-a", "Player");
		});

		it("clamps a placement outside the visible half onto it", () => {
			half.tapField({ x: 900, y: 1100 });

			expect(editor.addElement).toHaveBeenCalledWith(1000, 1000, "team-a", "Player");
		});

		it("keeps drags inside the visible half", () => {
			expect(half.dragMove({ x: 200, y: 500 })).toEqual({ x: 1000, y: 500 });

			half.dragEnd("el-1", { x: 2100, y: -5 });

			expect(editor.moveElement).toHaveBeenCalledWith("el-1", 2000, 0);
		});
	});
});
