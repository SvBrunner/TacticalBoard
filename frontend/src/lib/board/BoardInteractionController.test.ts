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
import type { Point } from "$lib/model/Point";
import { get } from "svelte/store";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { ArrowHandle } from "./ArrowHandle";
import type { GesturePoint } from "./ArrowGestures";

class FakeEditor implements BoardEditing {
	addElement = vi.fn((_x: number, _y: number, _color: string, _type: string) => "new-id");
	addArrow = vi.fn((_start: Point, _end: Point, _color: string, _type: string) => "new-arrow");
	removeElement = vi.fn();
	moveElement = vi.fn();
	reshapeArrow = vi.fn();
	moveArrow = vi.fn();
	addBend = vi.fn();
	removeBend = vi.fn();
	endGesture = vi.fn();
}

class FakeSelection implements ElementSelection {
	id: string | null = null;
	bend: number | null = null;
	current() {
		return this.id;
	}
	select(id: string) {
		this.id = id;
		this.bend = null;
	}
	selectBend(id: string, bendIndex: number) {
		this.id = id;
		this.bend = bendIndex;
	}
	clearBend() {
		this.bend = null;
	}
	clear() {
		this.id = null;
		this.bend = null;
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
	isOpen() {
		return this.anchor !== null;
	}
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
			arrowColor: "black",
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

	describe("dismissPopover (the popover's Close button / Escape)", () => {
		it("closes the popover and clears the selection", () => {
			controller.tapElement("el-1", anchor);

			controller.dismissPopover();

			expect(popover.anchor).toBeNull();
			expect(selection.id).toBeNull();
		});

		it("edits nothing", () => {
			controller.tapElement("el-1", anchor);

			controller.dismissPopover();

			expect(editor.removeElement).not.toHaveBeenCalled();
			expect(editor.addElement).not.toHaveBeenCalled();
		});
	});

	describe("relocatePopover (stage geometry changed)", () => {
		const moved: ScreenRect = { x: 300, y: 400, width: 30, height: 30 };

		it("keeps an open popover open and re-anchors it at the selected element", () => {
			controller.tapElement("el-1", anchor);
			const anchorOf = vi.fn((_id: string): ScreenRect | null => moved);

			controller.relocatePopover(anchorOf);

			expect(anchorOf).toHaveBeenCalledWith("el-1");
			expect(popover.anchor).toEqual(moved);
			expect(selection.id).toBe("el-1");
		});

		it("does not open a closed popover", () => {
			selection.select("el-1");
			const anchorOf = vi.fn((_id: string): ScreenRect | null => moved);

			controller.relocatePopover(anchorOf);

			expect(popover.anchor).toBeNull();
			expect(anchorOf).not.toHaveBeenCalled();
		});

		it("keeps the old anchor when the element can't be located", () => {
			controller.tapElement("el-1", anchor);

			controller.relocatePopover(() => null);

			expect(popover.anchor).toEqual(anchor);
		});

		it("keeps the old anchor without a selection", () => {
			popover.open(anchor);

			controller.relocatePopover(() => moved);

			expect(popover.anchor).toEqual(anchor);
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
			arrowColor: "black",
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
				arrowColor: "black",
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

	describe("with an arrow tool", () => {
		/** Scale 0.5: screen = scene / 2. */
		function at(x: number, y: number, pointerId = 1): GesturePoint {
			return { pointerId, scene: { x, y }, screen: { x: x / 2, y: y / 2 }, scale: 0.5 };
		}
		const noShift = { shiftKey: false };
		const anchorOf = vi.fn((_id: string): ScreenRect | null => anchor);

		function drag(from: Point, to: Point, elementId: string | null = null) {
			controller.pointerDown(at(from.x, from.y), elementId);
			controller.pointerMove(at(to.x, to.y));
			controller.pointerUp(at(to.x, to.y), noShift, anchorOf);
		}

		function tap(point: Point, elementId: string | null = null, modifiers = noShift) {
			controller.pointerDown(at(point.x, point.y), elementId);
			controller.pointerUp(at(point.x, point.y), modifiers, anchorOf);
		}

		beforeEach(() => {
			tools.tool = "Pass";
			anchorOf.mockClear();
		});

		it("reports that arrows are being drawn only for Pass, Run and Shot", () => {
			for (const tool of ["Pass", "Run", "Shot"] as Tool[]) {
				tools.tool = tool;
				expect(controller.isDrawingArrows()).toBe(true);
			}
			for (const tool of ["Move", "Player", "Ball", "Circle"] as Tool[]) {
				tools.tool = tool;
				expect(controller.isDrawingArrows()).toBe(false);
			}
		});

		it("press and drag adds a black arrow of the active type; the new arrow is not selected", () => {
			tools.tool = "Run";
			selection.select("old");
			popover.open(anchor);

			drag({ x: 100, y: 100 }, { x: 600, y: 300 });

			expect(editor.addArrow).toHaveBeenCalledWith({ x: 100, y: 100 }, { x: 600, y: 300 }, "black", "Run");
			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
			expect(log.notify).toHaveBeenCalledWith("Added Run");
		});

		it("tap, tap adds an arrow from the first to the second tap", () => {
			tap({ x: 100, y: 100 });
			expect(editor.addArrow).not.toHaveBeenCalled();
			expect(get(controller.arrowDraft)).toEqual({ start: { x: 100, y: 100 }, end: null });

			tap({ x: 700, y: 500 });

			expect(editor.addArrow).toHaveBeenCalledWith({ x: 100, y: 100 }, { x: 700, y: 500 }, "black", "Pass");
			expect(get(controller.arrowDraft)).toBeNull();
		});

		it("the first tap clears the selection and closes the popover", () => {
			selection.select("old");
			popover.open(anchor);

			tap({ x: 100, y: 100 });

			expect(selection.id).toBeNull();
			expect(popover.anchor).toBeNull();
		});

		it("the tool stays active: the next drag draws another arrow", () => {
			drag({ x: 100, y: 100 }, { x: 600, y: 300 });
			drag({ x: 200, y: 200 }, { x: 900, y: 300 });

			expect(editor.addArrow).toHaveBeenCalledTimes(2);
		});

		it("discards too short arrows without adding anything", () => {
			drag({ x: 100, y: 100 }, { x: 130, y: 100 });

			expect(editor.addArrow).not.toHaveBeenCalled();
			expect(log.notify).toHaveBeenCalledWith("Pass too short, discarded");
		});

		it("pressing on a player and dragging starts an arrow there instead of moving the player", () => {
			drag({ x: 500, y: 500 }, { x: 800, y: 500 }, "player-1");

			expect(editor.addArrow).toHaveBeenCalledWith({ x: 500, y: 500 }, { x: 800, y: 500 }, "black", "Pass");
			expect(editor.moveElement).not.toHaveBeenCalled();
		});

		it("a tap on an element (nothing pending) selects it and opens the popover at its anchor", () => {
			tap({ x: 500, y: 500 }, "player-1");

			expect(anchorOf).toHaveBeenCalledWith("player-1");
			expect(selection.id).toBe("player-1");
			expect(popover.anchor).toEqual(anchor);
			expect(editor.addArrow).not.toHaveBeenCalled();
		});

		it("a Shift+tap on an element deletes it", () => {
			tap({ x: 500, y: 500 }, "player-1", { shiftKey: true });

			expect(editor.removeElement).toHaveBeenCalledWith("player-1");
		});

		it("a tap on an element that can't be located does nothing", () => {
			anchorOf.mockReturnValueOnce(null);

			tap({ x: 500, y: 500 }, "gone");

			expect(selection.id).toBeNull();
		});

		it("with a start pending, a tap on an element ends the arrow there", () => {
			tap({ x: 100, y: 100 });
			tap({ x: 500, y: 500 }, "player-1");

			expect(editor.addArrow).toHaveBeenCalledWith({ x: 100, y: 100 }, { x: 500, y: 500 }, "black", "Pass");
			expect(selection.id).toBeNull();
		});

		it("clamps to the visible area", () => {
			drag({ x: -100, y: 500 }, { x: 2500, y: 1200 });

			expect(editor.addArrow).toHaveBeenCalledWith({ x: 0, y: 500 }, { x: 2000, y: 1000 }, "black", "Pass");
		});

		it("Konva taps (tapField/tapElement) are ignored: the gestures handle taps", () => {
			selection.select("old");

			controller.tapField({ x: 100, y: 100 });
			controller.tapElement("player-1", anchor);

			expect(editor.addElement).not.toHaveBeenCalled();
			expect(selection.id).toBe("old");
			expect(popover.anchor).toBeNull();
		});

		it("a context menu (long-press) on an element still selects it", () => {
			controller.contextMenu("player-1", anchor);

			expect(selection.id).toBe("player-1");
		});

		it("Escape drops a pending start", () => {
			tap({ x: 100, y: 100 });

			controller.keyDown(key("Escape"));
			tap({ x: 700, y: 500 });

			expect(editor.addArrow).not.toHaveBeenCalled();
			expect(get(controller.arrowDraft)).toEqual({ start: { x: 700, y: 500 }, end: null });
		});

		it("a tool change drops the drawing", () => {
			controller.pointerDown(at(100, 100), null);
			controller.pointerMove(at(600, 100));

			controller.toolChanged();
			controller.pointerUp(at(600, 100), noShift, anchorOf);

			expect(editor.addArrow).not.toHaveBeenCalled();
			expect(get(controller.arrowDraft)).toBeNull();
		});

		it("pointercancel drops the drawing", () => {
			controller.pointerDown(at(100, 100), null);
			controller.pointerMove(at(600, 100));

			controller.pointerCancel();
			controller.pointerUp(at(600, 100), noShift, anchorOf);

			expect(editor.addArrow).not.toHaveBeenCalled();
		});

		it("a second pointer drops the drawing", () => {
			controller.pointerDown(at(100, 100, 1), null);
			controller.pointerMove(at(600, 100, 1));
			controller.pointerDown(at(900, 100, 2), null);

			controller.pointerUp(at(600, 100, 1), noShift, anchorOf);
			controller.pointerUp(at(900, 100, 2), noShift, anchorOf);

			expect(editor.addArrow).not.toHaveBeenCalled();
		});

		it("pointer input is ignored with the Move tool and point tools", () => {
			for (const tool of ["Move", "Player"] as Tool[]) {
				tools.tool = tool;
				drag({ x: 100, y: 100 }, { x: 600, y: 300 });
				tap({ x: 100, y: 100 });
				tap({ x: 500, y: 300 });
			}

			expect(editor.addArrow).not.toHaveBeenCalled();
			expect(get(controller.arrowDraft)).toBeNull();
		});

		it("draws inside the visible half on a half field", () => {
			const half = new BoardInteractionController({
				editor,
				selection,
				tools,
				popover,
				bounds: new BoardViewport(FieldDimensions.FLOORBALL, "half"),
				neutralColor: "neutral",
				arrowColor: "black",
			});

			half.pointerDown(at(500, 500), null);
			half.pointerMove(at(1600, 500));
			half.pointerUp(at(1600, 500), noShift, anchorOf);

			expect(editor.addArrow).toHaveBeenCalledWith({ x: 1000, y: 500 }, { x: 1600, y: 500 }, "black", "Pass");
		});
	});

	describe("arrows", () => {
		const geometry = new ArrowGeometry({ x: 100, y: 100 }, { x: 500, y: 100 }, [{ x: 300, y: 300 }]);

		describe("dragging a whole arrow", () => {
			it("closes the popover when it starts", () => {
				popover.open(anchor);

				controller.arrowDragStart("a");

				expect(popover.anchor).toBeNull();
			});

			it("limits the move so every point stays in the visible area", () => {
				expect(controller.arrowDragMove(geometry, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
				expect(controller.arrowDragMove(geometry, { x: 2000, y: -500 })).toEqual({ x: 1500, y: -100 });
			});

			it("ends with one move and a sealed history", () => {
				controller.arrowDragEnd("a", geometry, { x: 2000, y: 10 });

				expect(editor.moveArrow).toHaveBeenCalledWith("a", 1500, 10);
				expect(editor.endGesture).toHaveBeenCalledOnce();
			});
		});

		describe("dragging a handle", () => {
			it("closes the popover when it starts", () => {
				popover.open(anchor);

				controller.handleDragStart("a");

				expect(popover.anchor).toBeNull();
			});

			it("previews the reshaped arrow with the point clamped", () => {
				const preview = controller.handleDragMove(geometry, ArrowHandle.end(), { x: 2500, y: 50 });

				expect(preview.end).toEqual({ x: 2000, y: 50 });
				expect(geometry.end).toEqual({ x: 500, y: 100 });
			});

			it("previews an inserted bend for an add-bend handle", () => {
				expect(controller.handleDragMove(geometry, ArrowHandle.insert(1), { x: 400, y: 400 }).bends).toEqual([
					{ x: 300, y: 300 },
					{ x: 400, y: 400 },
				]);
			});

			it("dropping a point handle reshapes the arrow in one undo step", () => {
				controller.handleDragEnd("a", geometry, ArrowHandle.bend(0), { x: 320, y: -40 });

				const [id, reshaped] = editor.reshapeArrow.mock.calls[0];
				expect(id).toBe("a");
				expect((reshaped as ArrowGeometry).bends).toEqual([{ x: 320, y: 0 }]);
				expect(editor.endGesture).toHaveBeenCalledOnce();
			});

			it("dropping an add-bend handle adds a bend in that segment", () => {
				controller.handleDragEnd("a", geometry, ArrowHandle.insert(0), { x: 200, y: 400 });

				expect(editor.addBend).toHaveBeenCalledWith("a", 0, { x: 200, y: 400 });
				expect(editor.reshapeArrow).not.toHaveBeenCalled();
				expect(editor.endGesture).toHaveBeenCalledOnce();
			});
		});

		describe("tapping a handle", () => {
			it("a bend handle becomes the active bend and the popover opens", () => {
				controller.tapHandle("a", geometry, ArrowHandle.bend(0), anchor);

				expect(selection.id).toBe("a");
				expect(selection.bend).toBe(0);
				expect(popover.anchor).toEqual(anchor);
				expect(editor.addBend).not.toHaveBeenCalled();
			});

			it("the start or end handle keeps the arrow selected without an active bend and leaves the popover alone", () => {
				selection.selectBend("a", 0);

				controller.tapHandle("a", geometry, ArrowHandle.end(), anchor);

				expect(selection.id).toBe("a");
				expect(selection.bend).toBeNull();
				expect(popover.anchor).toBeNull();
			});

			it("an add-bend handle adds a bend at its position without opening the popover", () => {
				controller.tapHandle("a", geometry, ArrowHandle.insert(1), anchor);

				expect(editor.addBend).toHaveBeenCalledWith("a", 1, geometry.segmentMidpoint(1));
				expect(selection.id).toBe("a");
				expect(popover.anchor).toBeNull();
			});

			it("works with an arrow tool active too", () => {
				tools.tool = "Shot";

				controller.tapHandle("a", geometry, ArrowHandle.bend(0), anchor);

				expect(selection.bend).toBe(0);
			});
		});

		it("Edit shape closes the popover but keeps the arrow selected", () => {
			selection.selectBend("a", 0);
			popover.open(anchor);

			controller.editShape();

			expect(popover.anchor).toBeNull();
			expect(selection.id).toBe("a");
			expect(selection.bend).toBe(0);
		});

		describe("double-tapping a handle", () => {
			it("removes a bend and clears the active bend", () => {
				selection.selectBend("a", 0);

				controller.doubleTapHandle("a", ArrowHandle.bend(0));

				expect(editor.removeBend).toHaveBeenCalledWith("a", 0);
				expect(selection.id).toBe("a");
				expect(selection.bend).toBeNull();
			});

			it("does nothing on the start, end and add-bend handles", () => {
				controller.doubleTapHandle("a", ArrowHandle.start());
				controller.doubleTapHandle("a", ArrowHandle.end());
				controller.doubleTapHandle("a", ArrowHandle.insert(0));

				expect(editor.removeBend).not.toHaveBeenCalled();
			});
		});
	});
});
