import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { FixedClock } from "$lib/model/Clock";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { DEFAULT_SITUATION_TITLE, Situation } from "$lib/model/Situation";
import { EMPTY_HISTORY_STATUS, type HistoryStatus } from "$lib/history/HistoryStatus";
import { SituationEditor, situationEditor } from "./SituationEditor";

const START = "2026-01-01T00:00:00.000Z";

function twoFrameSituation(): Situation {
	return new Situation({
		id: "loaded",
		title: "Loaded",
		description: "",
		sport: "floorball",
		fieldType: "half",
		createdAt: START,
		updatedAt: START,
		frames: [
			new Frame("f1", "", [new PointElement("p1", 0, 0, "red", "Player")]),
			new Frame("f2", "", [new PointElement("p1", 50, 50, "red", "Player")]),
		],
	});
}

describe("SituationEditor", () => {
	let clock: FixedClock;
	let editor: SituationEditor;

	beforeEach(() => {
		clock = new FixedClock(START);
		editor = new SituationEditor(new SequentialIdGenerator(), clock);
	});

	it("starts with a new full-field floorball situation with one empty frame", () => {
		const situation = editor.current();

		expect(situation).toMatchObject({ sport: "floorball", fieldType: "full", title: DEFAULT_SITUATION_TITLE });
		expect(situation.frames).toHaveLength(1);
		expect(get(editor.situation)).toBe(situation);
		expect(get(editor.activeFrame)).toBe(situation.frames[0]);
	});

	it("starts empty", () => {
		expect(get(editor.elements)).toEqual([]);
	});

	it("can start with a given situation", () => {
		const initial = twoFrameSituation();

		const custom = new SituationEditor(new SequentialIdGenerator(), clock, initial);

		expect(custom.current()).toBe(initial);
		expect(get(custom.activeFrame).id).toBe("f1");
	});

	it("addElement appends a new element and returns its id", () => {
		const id = editor.addElement(10, 20, "blue", "Ball");

		const elements = get(editor.elements);
		expect(elements).toHaveLength(1);
		expect(elements[0]).toBeInstanceOf(PointElement);
		expect(elements[0]).toMatchObject({ id, x: 10, y: 20, color: "blue", type: "Ball" });
	});

	it("addElement generates a different id for each element", () => {
		const a = editor.addElement(0, 0, "red", "Player");
		const b = editor.addElement(0, 0, "red", "Player");

		expect(a).not.toBe(b);
	});

	it("removeElement removes only the matching element", () => {
		const first = editor.addElement(0, 0, "blue", "Player");
		const second = editor.addElement(1, 1, "red", "Player");

		editor.removeElement(first);

		const remaining = get(editor.elements);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].id).toBe(second);
	});

	it("moveElement updates x and y for the matching element only", () => {
		const first = editor.addElement(0, 0, "blue", "Player");
		const second = editor.addElement(0, 0, "blue", "Player");

		editor.moveElement(first, 5, 6);

		const [movedFirst, untouchedSecond] = get(editor.elements);
		expect(movedFirst).toMatchObject({ id: first, x: 5, y: 6 });
		expect(untouchedSecond).toMatchObject({ id: second, x: 0, y: 0 });
	});

	it("changeColor updates only the matching element's color", () => {
		const first = editor.addElement(0, 0, "blue", "Player");
		editor.addElement(0, 0, "blue", "Player");

		editor.changeColor(first, "green");

		expect(get(editor.elements).map((element) => element.color)).toEqual(["green", "blue"]);
	});

	it("changeType updates only the matching element's type and keeps its id", () => {
		const first = editor.addElement(0, 0, "blue", "Player");
		editor.addElement(0, 0, "blue", "Player");

		editor.changeType(first, "Circle");

		const [changed, untouched] = get(editor.elements);
		expect(changed).toMatchObject({ id: first, type: "Circle" });
		expect(untouched.type).toBe("Player");
	});

	it("remove/move/changeColor/changeType are no-ops for an unknown id", () => {
		editor.addElement(0, 0, "blue", "Player");
		clock.advance(1000);
		const before = editor.current();

		editor.removeElement("missing");
		editor.moveElement("missing", 9, 9);
		editor.changeColor("missing", "green");
		editor.changeType("missing", "Circle");

		expect(editor.current()).toBe(before);
	});

	it("produces a new situation, frame, and elements reference on every mutation", () => {
		const id = editor.addElement(0, 0, "blue", "Player");
		const situationBefore = editor.current();
		const frameBefore = get(editor.activeFrame);
		const elementsBefore = get(editor.elements);

		editor.moveElement(id, 1, 1);

		expect(editor.current()).not.toBe(situationBefore);
		expect(get(editor.activeFrame)).not.toBe(frameBefore);
		expect(get(editor.elements)).not.toBe(elementsBefore);
		expect(elementsBefore[0]).toMatchObject({ x: 0, y: 0 });
	});

	it("notifies subscribers on every mutation", () => {
		const seen: number[] = [];
		const unsubscribe = editor.elements.subscribe((elements) => seen.push(elements.length));

		const id = editor.addElement(0, 0, "blue", "Player");
		editor.addElement(0, 0, "blue", "Player");
		editor.removeElement(id);
		unsubscribe();

		expect(seen).toEqual([0, 1, 2, 1]);
	});

	it("refreshes updatedAt on every change but keeps createdAt", () => {
		clock.set("2026-01-01T10:00:00.000Z");
		const id = editor.addElement(0, 0, "blue", "Player");
		expect(editor.current().updatedAt).toBe("2026-01-01T10:00:00.000Z");

		clock.set("2026-01-01T11:00:00.000Z");
		editor.changeColor(id, "green");
		expect(editor.current().updatedAt).toBe("2026-01-01T11:00:00.000Z");

		expect(editor.current().createdAt).toBe(START);
	});

	it("does not refresh updatedAt when nothing changes", () => {
		clock.set("2026-06-01T00:00:00.000Z");

		editor.removeElement("missing");

		expect(editor.current().updatedAt).toBe(START);
	});

	it("keeps the situation id across edits", () => {
		const id = editor.current().id;

		editor.addElement(0, 0, "blue", "Player");

		expect(editor.current().id).toBe(id);
	});

	describe("load", () => {
		it("replaces the situation and resets the active frame to the first frame", () => {
			const loaded = twoFrameSituation();

			editor.load(loaded);

			expect(editor.current()).toBe(loaded);
			expect(get(editor.situation)).toBe(loaded);
			expect(get(editor.activeFrame).id).toBe("f1");
			expect(get(editor.elements)).toEqual(loaded.frames[0].elements);
		});

		it("does not change updatedAt", () => {
			clock.set("2026-06-01T00:00:00.000Z");

			editor.load(twoFrameSituation());

			expect(editor.current().updatedAt).toBe(START);
		});

		it("edits only touch the active (first) frame; other frames stay untouched", () => {
			const loaded = twoFrameSituation();
			editor.load(loaded);

			editor.moveElement("p1", 9, 9);
			editor.addElement(1, 1, "blue", "Ball");

			const [first, second] = editor.current().frames;
			expect(first.findElement("p1")).toMatchObject({ x: 9, y: 9 });
			expect(first.elements).toHaveLength(2);
			expect(second).toBe(loaded.frames[1]);
		});
	});

	describe("selectFrame", () => {
		it("switches the active frame without changing the situation", () => {
			editor.load(twoFrameSituation());
			const before = editor.current();

			editor.selectFrame("f2");

			expect(get(editor.activeFrame).id).toBe("f2");
			expect(get(editor.elements)).toEqual(before.frames[1].elements);
			expect(editor.current()).toBe(before);
		});

		it("is not an undo step", () => {
			editor.load(twoFrameSituation());

			editor.selectFrame("f2");

			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
			editor.selectFrame("f1");
			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
		});

		it("throws for an unknown frame id", () => {
			expect(() => editor.selectFrame("missing")).toThrow(/no frame/);
		});

		it("edits go to the newly active frame", () => {
			editor.load(twoFrameSituation());

			editor.selectFrame("f2");
			editor.moveElement("p1", 7, 7);

			const [first, second] = editor.current().frames;
			expect(first.findElement("p1")).toMatchObject({ x: 0, y: 0 });
			expect(second.findElement("p1")).toMatchObject({ x: 7, y: 7 });
		});
	});

	describe("undo/redo", () => {
		const elementsNow = () => get(editor.elements);

		it("starts with nothing to undo or redo", () => {
			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
			expect(editor.undo()).toBeUndefined();
			expect(editor.redo()).toBeUndefined();
		});

		it("addElement is undoable and redo re-adds the same element id", () => {
			const id = editor.addElement(10, 20, "blue", "Ball");

			expect(editor.undo()).toBe("Add Ball");
			expect(elementsNow()).toEqual([]);

			expect(editor.redo()).toBe("Add Ball");
			expect(elementsNow()).toHaveLength(1);
			expect(elementsNow()[0]).toMatchObject({ id, x: 10, y: 20, color: "blue", type: "Ball" });
		});

		it("removeElement is undoable and restores the original z-order", () => {
			const a = editor.addElement(0, 0, "red", "Player");
			const b = editor.addElement(1, 1, "red", "Player");
			const c = editor.addElement(2, 2, "red", "Player");

			editor.removeElement(b);
			expect(elementsNow().map((element) => element.id)).toEqual([a, c]);

			expect(editor.undo()).toBe("Delete Player");
			expect(elementsNow().map((element) => element.id)).toEqual([a, b, c]);

			editor.redo();
			expect(elementsNow().map((element) => element.id)).toEqual([a, c]);
		});

		it("moveElement is undoable and redoable", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			editor.endGesture();

			editor.moveElement(id, 5, 6);

			expect(editor.undo()).toBe("Move Player");
			expect(elementsNow()[0]).toMatchObject({ x: 0, y: 0 });
			editor.redo();
			expect(elementsNow()[0]).toMatchObject({ x: 5, y: 6 });
		});

		it("consecutive moves of one element merge into one step until endGesture", () => {
			const id = editor.addElement(0, 0, "red", "Player");

			editor.moveElement(id, 1, 1);
			editor.moveElement(id, 2, 2);
			editor.endGesture();
			editor.moveElement(id, 3, 3);

			editor.undo();
			expect(elementsNow()[0]).toMatchObject({ x: 2, y: 2 });
			editor.undo();
			expect(elementsNow()[0]).toMatchObject({ x: 0, y: 0 });
			expect(get(editor.history).undoLabel).toBe("Add Player");
		});

		it("changeColor is undoable and redoable", () => {
			const id = editor.addElement(0, 0, "red", "Player");

			editor.changeColor(id, "green");

			expect(editor.undo()).toBe("Change Player color");
			expect(elementsNow()[0].color).toBe("red");
			editor.redo();
			expect(elementsNow()[0].color).toBe("green");
		});

		it("changeType is undoable and redoable", () => {
			const id = editor.addElement(0, 0, "red", "Player");

			editor.changeType(id, "Circle");

			expect(editor.undo()).toBe("Change Player to Circle");
			expect(elementsNow()[0]).toMatchObject({ id, type: "Player" });
			editor.redo();
			expect(elementsNow()[0]).toMatchObject({ id, type: "Circle" });
		});

		it("unchanged edits and unknown ids create no undo steps", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			editor.endGesture();

			editor.moveElement(id, 0, 0);
			editor.changeColor(id, "red");
			editor.changeType(id, "Player");
			editor.removeElement("missing");
			editor.moveElement("missing", 1, 1);
			editor.changeColor("missing", "green");
			editor.changeType("missing", "Ball");

			expect(get(editor.history).undoLabel).toBe("Add Player");
			editor.undo();
			expect(get(editor.history).canUndo).toBe(false);
		});

		it("a new edit after undo clears redo", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			editor.changeColor(id, "green");
			editor.undo();

			editor.changeColor(id, "blue");

			expect(get(editor.history).canRedo).toBe(false);
			expect(editor.redo()).toBeUndefined();
		});

		it("undo and redo with nothing to do leave the situation untouched", () => {
			const before = editor.current();
			clock.advance(1000);

			editor.undo();
			editor.redo();

			expect(editor.current()).toBe(before);
		});

		it("refreshes updatedAt on undo and on redo", () => {
			editor.addElement(0, 0, "red", "Player");

			clock.set("2026-02-01T00:00:00.000Z");
			editor.undo();
			expect(editor.current().updatedAt).toBe("2026-02-01T00:00:00.000Z");

			clock.set("2026-03-01T00:00:00.000Z");
			editor.redo();
			expect(editor.current().updatedAt).toBe("2026-03-01T00:00:00.000Z");
			expect(editor.current().createdAt).toBe(START);
		});

		it("the history store reflects the active frame's history", () => {
			const seen: HistoryStatus[] = [];
			const unsubscribe = editor.history.subscribe((status) => seen.push(status));

			editor.addElement(0, 0, "red", "Player");
			editor.undo();
			editor.redo();
			unsubscribe();

			expect(seen).toEqual([
				EMPTY_HISTORY_STATUS,
				{ canUndo: true, canRedo: false, undoLabel: "Add Player", redoLabel: undefined },
				{ canUndo: false, canRedo: true, undoLabel: undefined, redoLabel: "Add Player" },
				{ canUndo: true, canRedo: false, undoLabel: "Add Player", redoLabel: undefined },
			]);
		});

		it("keeps an independent history per frame", () => {
			editor.load(twoFrameSituation());

			editor.moveElement("p1", 1, 1);
			editor.selectFrame("f2");
			expect(get(editor.history).canUndo).toBe(false);

			editor.changeColor("p1", "green");
			editor.addElement(3, 3, "blue", "Ball");
			expect(get(editor.history).undoLabel).toBe("Add Ball");

			editor.selectFrame("f1");
			expect(get(editor.history)).toMatchObject({ canUndo: true, undoLabel: "Move Player" });
			editor.undo();

			const [first, second] = editor.current().frames;
			expect(first.findElement("p1")).toMatchObject({ x: 0, y: 0 });
			expect(second.findElement("p1")).toMatchObject({ x: 50, y: 50, color: "green" });
			expect(second.elements).toHaveLength(2);

			editor.selectFrame("f2");
			editor.undo();
			editor.undo();
			expect(editor.current().frames[1].elements).toEqual(twoFrameSituation().frames[1].elements);
			expect(get(editor.history).canUndo).toBe(false);
		});

		it("switching frames ends the edit session, so moves don't merge across a switch", () => {
			editor.load(twoFrameSituation());
			editor.moveElement("p1", 1, 1);

			editor.selectFrame("f2");
			editor.selectFrame("f1");
			editor.moveElement("p1", 2, 2);

			editor.undo();
			expect(get(editor.elements)[0]).toMatchObject({ x: 1, y: 1 });
		});

		it("the history store follows frame switches", () => {
			editor.load(twoFrameSituation());
			const seen: boolean[] = [];
			const unsubscribe = editor.history.subscribe((status) => seen.push(status.canUndo));

			editor.moveElement("p1", 1, 1);
			editor.selectFrame("f2");
			editor.selectFrame("f1");
			unsubscribe();

			expect(seen).toEqual([false, true, false, true]);
		});

		it("load is not undoable and clears every frame's history", () => {
			editor.load(twoFrameSituation());
			editor.moveElement("p1", 1, 1);
			editor.selectFrame("f2");
			editor.moveElement("p1", 2, 2);
			editor.undo();

			const reloaded = twoFrameSituation();
			editor.load(reloaded);

			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
			expect(editor.undo()).toBeUndefined();
			expect(editor.redo()).toBeUndefined();
			expect(editor.current()).toBe(reloaded);
			editor.selectFrame("f2");
			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
		});

		it("load clears the history of the initial situation", () => {
			editor.addElement(0, 0, "red", "Player");

			editor.load(twoFrameSituation());

			expect(get(editor.history).canUndo).toBe(false);
		});

		it("the history store keeps working after load with the same frame ids", () => {
			editor.load(twoFrameSituation());
			const seen: boolean[] = [];
			const unsubscribe = editor.history.subscribe((status) => seen.push(status.canUndo));

			editor.moveElement("p1", 1, 1);
			editor.load(twoFrameSituation());
			editor.moveElement("p1", 2, 2);
			unsubscribe();

			expect(seen).toEqual([false, true, false, true]);
		});
	});

	describe("isSituationOpen", () => {
		it("is false for the blank placeholder situation the editor starts with", () => {
			expect(editor.isSituationOpen()).toBe(false);
		});

		it("is true when constructed with a situation", () => {
			expect(new SituationEditor(new SequentialIdGenerator(), clock, twoFrameSituation()).isSituationOpen()).toBe(true);
		});

		it("becomes true after load", () => {
			editor.load(twoFrameSituation());

			expect(editor.isSituationOpen()).toBe(true);
		});

		it("becomes true after createNew", () => {
			editor.createNew({ title: "x", fieldType: "full" });

			expect(editor.isSituationOpen()).toBe(true);
		});
	});

	describe("createNew", () => {
		it("creates a floorball situation with the title, field type, one empty frame and fresh ids", () => {
			const ids = new SequentialIdGenerator("id-");
			const fresh = new SituationEditor(ids, clock);
			fresh.addElement(1, 1, "red", "Player");

			const created = fresh.createNew({ title: "Powerplay", fieldType: "half" });

			expect(fresh.current()).toBe(created);
			expect(created).toMatchObject({ title: "Powerplay", description: "", sport: "floorball", fieldType: "half" });
			expect(created.frames).toHaveLength(1);
			expect(created.frames[0].elements).toEqual([]);
			const usedIds = [created.id, created.frames[0].id];
			expect(new Set(usedIds).size).toBe(2);
			expect(usedIds.every((id) => id.startsWith("id-"))).toBe(true);
			expect(created.id).not.toBe(get(fresh.situation).frames[0].id);
		});

		it("gets a different situation id than the previous situation", () => {
			const before = editor.current().id;

			expect(editor.createNew({ title: "", fieldType: "full" }).id).not.toBe(before);
		});

		it.each([["full" as const], ["half" as const]])("keeps the field type %s", (fieldType) => {
			expect(editor.createNew({ title: "t", fieldType }).fieldType).toBe(fieldType);
		});

		it.each([[""], ["   "], ["\t\n"]])("stores the default title for the blank title %j", (title) => {
			const created = editor.createNew({ title, fieldType: "full" });

			expect(created.title).toBe(DEFAULT_SITUATION_TITLE);
		});

		it("keeps a non-blank title as entered", () => {
			expect(editor.createNew({ title: "Breakout 1", fieldType: "full" }).title).toBe("Breakout 1");
		});

		it("sets createdAt and updatedAt to now", () => {
			clock.set("2026-09-09T09:09:09.000Z");

			const created = editor.createNew({ title: "t", fieldType: "full" });

			expect(created.createdAt).toBe("2026-09-09T09:09:09.000Z");
			expect(created.updatedAt).toBe("2026-09-09T09:09:09.000Z");
		});

		it("makes the first frame active", () => {
			editor.load(twoFrameSituation());
			editor.selectFrame("f2");

			const created = editor.createNew({ title: "t", fieldType: "full" });

			expect(get(editor.activeFrame)).toBe(created.frames[0]);
			expect(get(editor.elements)).toEqual([]);
		});

		it("is not undoable and clears every history", () => {
			editor.load(twoFrameSituation());
			editor.moveElement("p1", 1, 1);
			editor.selectFrame("f2");
			editor.moveElement("p1", 2, 2);
			editor.undo();

			editor.createNew({ title: "t", fieldType: "half" });

			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
			expect(editor.undo()).toBeUndefined();
			expect(editor.redo()).toBeUndefined();
		});

		it("uses the given sport", () => {
			expect(editor.createNew({ title: "t", fieldType: "full", sport: "floorball" }).sport).toBe("floorball");
		});
	});

	describe("unsaved changes", () => {
		const dirtyNow = () => get(editor.hasUnsavedChanges);

		it("has none at the start", () => {
			expect(dirtyNow()).toBe(false);
			expect(editor.isDirty()).toBe(false);
		});

		it.each([
			["addElement", (e: SituationEditor) => e.addElement(0, 0, "red", "Player")],
			["removeElement", (e: SituationEditor) => e.removeElement("p1")],
			["moveElement", (e: SituationEditor) => e.moveElement("p1", 5, 5)],
			["changeColor", (e: SituationEditor) => e.changeColor("p1", "green")],
			["changeType", (e: SituationEditor) => e.changeType("p1", "Ball")],
		])("%s marks the situation dirty", (_name, edit) => {
			editor.load(twoFrameSituation());

			edit(editor);

			expect(dirtyNow()).toBe(true);
			expect(editor.isDirty()).toBe(true);
		});

		it("edits that change nothing don't mark it dirty", () => {
			editor.load(twoFrameSituation());

			editor.moveElement("p1", 0, 0);
			editor.removeElement("missing");
			editor.undo();
			editor.redo();
			editor.selectFrame("f2");
			editor.endGesture();

			expect(dirtyNow()).toBe(false);
		});

		it("markSaved clears it, a later edit sets it again", () => {
			editor.addElement(0, 0, "red", "Player");

			editor.markSaved();
			expect(dirtyNow()).toBe(false);

			editor.addElement(1, 1, "red", "Player");
			expect(dirtyNow()).toBe(true);
		});

		it("markSaved without changes changes nothing", () => {
			const before = editor.current();

			editor.markSaved();

			expect(dirtyNow()).toBe(false);
			expect(editor.current()).toBe(before);
		});

		it("undo after saving counts as a change", () => {
			editor.addElement(0, 0, "red", "Player");
			editor.markSaved();

			editor.undo();
			expect(dirtyNow()).toBe(true);

			editor.markSaved();
			editor.redo();
			expect(dirtyNow()).toBe(true);
		});

		it("undoing back to the starting state still counts as unsaved (simple flag)", () => {
			editor.addElement(0, 0, "red", "Player");

			editor.undo();

			expect(get(editor.history).canUndo).toBe(false);
			expect(dirtyNow()).toBe(true);
		});

		it("load clears it", () => {
			editor.addElement(0, 0, "red", "Player");

			editor.load(twoFrameSituation());

			expect(dirtyNow()).toBe(false);
		});

		it("createNew clears it", () => {
			editor.addElement(0, 0, "red", "Player");

			editor.createNew({ title: "", fieldType: "half" });

			expect(dirtyNow()).toBe(false);
		});

		it("the store notifies only on actual changes", () => {
			const seen: boolean[] = [];
			const unsubscribe = editor.hasUnsavedChanges.subscribe((dirty) => seen.push(dirty));

			const id = editor.addElement(0, 0, "red", "Player");
			editor.moveElement(id, 3, 3);
			editor.markSaved();
			editor.markSaved();
			unsubscribe();

			expect(seen).toEqual([false, true, false]);
		});
	});

	describe("changeLabel", () => {
		const labelOf = (id: string) => (get(editor.elements).find((e) => e.id === id) as PointElement).label;

		it("newly placed players have no label", () => {
			const id = editor.addElement(0, 0, "red", "Player");

			expect(labelOf(id)).toBe("");
		});

		it("sets and clears the label of the matching element only", () => {
			const first = editor.addElement(0, 0, "red", "Player");
			const second = editor.addElement(1, 1, "red", "Player");

			editor.changeLabel(first, "C");
			expect(labelOf(first)).toBe("C");
			expect(labelOf(second)).toBe("");

			editor.changeLabel(first, "");
			expect(labelOf(first)).toBe("");
		});

		it("is a no-op for an unknown id or an unchanged label", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			const before = editor.current();

			editor.changeLabel("missing", "C");
			editor.changeLabel(id, "");

			expect(editor.current()).toBe(before);
			expect(get(editor.history).undoLabel).toBe("Add Player");
		});

		it("one edit session is one undo step; endGesture starts the next", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			editor.endGesture();

			editor.changeLabel(id, "1");
			editor.changeLabel(id, "10");
			editor.endGesture();
			editor.changeLabel(id, "C");

			expect(editor.undo()).toBe("Change Player label");
			expect(labelOf(id)).toBe("10");
			expect(editor.undo()).toBe("Change Player label");
			expect(labelOf(id)).toBe("");
			expect(get(editor.history).undoLabel).toBe("Add Player");
			editor.redo();
			expect(labelOf(id)).toBe("10");
		});

		it("label changes of different elements are separate undo steps", () => {
			const first = editor.addElement(0, 0, "red", "Player");
			const second = editor.addElement(1, 1, "red", "Player");

			editor.changeLabel(first, "G");
			editor.changeLabel(second, "C");
			editor.undo();

			expect(labelOf(first)).toBe("G");
			expect(labelOf(second)).toBe("");
		});

		it("is per frame: other frames keep their labels and their own history", () => {
			editor.load(twoFrameSituation());

			editor.changeLabel("p1", "LV");
			editor.selectFrame("f2");

			expect(labelOf("p1")).toBe("");
			expect(get(editor.history).canUndo).toBe(false);
			editor.changeLabel("p1", "RV");
			editor.selectFrame("f1");
			expect(labelOf("p1")).toBe("LV");
			editor.undo();
			expect(labelOf("p1")).toBe("");
			expect((editor.current().frames[1].findElement("p1") as PointElement).label).toBe("RV");
		});

		it("survives a type change and back", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			editor.changeLabel(id, "F");

			editor.changeType(id, "Circle");
			expect(labelOf(id)).toBe("F");
			editor.changeType(id, "Player");
			expect(labelOf(id)).toBe("F");
		});

		it("marks the situation dirty and refreshes updatedAt", () => {
			const id = editor.addElement(0, 0, "red", "Player");
			editor.markSaved();
			clock.set("2026-02-02T00:00:00.000Z");

			editor.changeLabel(id, "C");

			expect(editor.isDirty()).toBe(true);
			expect(editor.current().updatedAt).toBe("2026-02-02T00:00:00.000Z");
		});
	});

	it("exports a shared singleton instance", () => {
		expect(situationEditor).toBeInstanceOf(SituationEditor);
	});
});
