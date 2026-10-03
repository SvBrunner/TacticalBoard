import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { FixedClock } from "$lib/model/Clock";
import { PointElement } from "$lib/model/elements/PointElement";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { DEFAULT_SITUATION_TITLE, Situation } from "$lib/model/Situation";
import { EMPTY_HISTORY_STATUS, type HistoryStatus } from "$lib/history/HistoryStatus";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
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

	describe("close", () => {
		it("drops the situation, its unsaved changes and its histories", () => {
			editor.createNew({ title: "Closing", fieldType: "half" });
			editor.addElement(1, 1, "red", "Player");

			editor.close();

			expect(editor.isSituationOpen()).toBe(false);
			expect(editor.isDirty()).toBe(false);
			expect(get(editor.hasUnsavedChanges)).toBe(false);
			expect(editor.current()).toMatchObject({ title: DEFAULT_SITUATION_TITLE, fieldType: "full" });
			expect(get(editor.elements)).toEqual([]);
			expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
		});

		it("a situation can be created again afterwards", () => {
			editor.close();
			editor.createNew({ title: "Again", fieldType: "full" });

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

	describe("frames (situation-level, not undoable)", () => {
		const LATER = "2026-03-03T00:00:00.000Z";

		function threeFrameSituation(): Situation {
			return new Situation({
				id: "s3",
				title: "Three",
				description: "",
				sport: "floorball",
				fieldType: "full",
				createdAt: START,
				updatedAt: START,
				frames: [
					new Frame("f1", "first", [new PointElement("p1", 10, 10, "red", "Player", "C")]),
					new Frame("f2", "second", [new PointElement("p1", 20, 20, "red", "Player", "C")]),
					new Frame("f3", "third", [new PointElement("p1", 30, 30, "red", "Player", "C")]),
				],
			});
		}

		const order = () => editor.current().frames.map((frame) => frame.id);
		const activeId = () => get(editor.activeFrame).id;

		beforeEach(() => {
			editor.load(threeFrameSituation());
		});

		describe("addFrame", () => {
			it("inserts a copy of the active frame right after it and makes it active", () => {
				editor.selectFrame("f2");

				const id = editor.addFrame();

				expect(order()).toEqual(["f1", "f2", id, "f3"]);
				expect(activeId()).toBe(id);
				expect(editor.currentFrame().id).toBe(id);
			});

			it("appends after the last frame when the last frame is active", () => {
				editor.selectFrame("f3");

				const id = editor.addFrame();

				expect(order()).toEqual(["f1", "f2", "f3", id]);
			});

			it("copies elements (same ids) and the description under a new frame id", () => {
				editor.selectFrame("f2");
				const source = editor.currentFrame();

				const id = editor.addFrame();

				const copy = editor.current().findFrame(id)!;
				expect(id).not.toBe("f2");
				expect(copy.description).toBe("second");
				expect(copy.elements).toEqual(source.elements);
				expect(copy.elements.map((element) => element.id)).toEqual(["p1"]);
			});

			it("starts the new frame with an empty history and leaves the source history as it was", () => {
				editor.moveElement("p1", 50, 50);
				editor.endGesture();

				editor.addFrame();

				expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
				editor.selectFrame("f1");
				expect(get(editor.history).canUndo).toBe(true);
				editor.undo();
				expect(editor.currentFrame().findElement("p1")).toMatchObject({ x: 10, y: 10 });
			});

			it("is not an undo step: undo in the new frame does not remove it", () => {
				const id = editor.addFrame();

				editor.undo();

				expect(order()).toContain(id);
			});

			it("later changes to the copy don't change the source frame and vice versa", () => {
				const id = editor.addFrame();

				editor.moveElement("p1", 99, 99);
				editor.changeLabel("p1", "F");
				editor.changeFrameDescription("changed copy");

				const source = editor.current().findFrame("f1")!;
				expect(source.findElement("p1")).toMatchObject({ x: 10, y: 10, label: "C" });
				expect(source.description).toBe("first");

				editor.selectFrame("f1");
				editor.moveElement("p1", 1, 1);
				expect(editor.current().findFrame(id)!.findElement("p1")).toMatchObject({ x: 99, y: 99 });
			});

			it("seals the source frame's edit session", () => {
				editor.changeFrameDescription("a");
				editor.addFrame();
				editor.selectFrame("f1");

				editor.changeFrameDescription("ab");
				editor.undo();

				expect(editor.currentFrame().description).toBe("a");
			});

			it("marks the situation dirty and refreshes updatedAt", () => {
				clock.set(LATER);

				editor.addFrame();

				expect(editor.isDirty()).toBe(true);
				expect(editor.current().updatedAt).toBe(LATER);
			});
		});

		describe("deleteFrame", () => {
			it("removes the frame", () => {
				expect(editor.deleteFrame("f2")).toBe(true);

				expect(order()).toEqual(["f1", "f3"]);
			});

			it("makes the previous frame active when the active frame is deleted", () => {
				editor.selectFrame("f3");

				editor.deleteFrame("f3");

				expect(activeId()).toBe("f2");
			});

			it("makes the next frame active when the first frame is deleted while active", () => {
				editor.deleteFrame("f1");

				expect(activeId()).toBe("f2");
			});

			it("keeps the active frame when another frame is deleted", () => {
				editor.selectFrame("f3");

				editor.deleteFrame("f1");

				expect(activeId()).toBe("f3");
			});

			it("refuses to delete the last remaining frame", () => {
				editor.deleteFrame("f1");
				editor.deleteFrame("f2");
				const before = editor.current();
				editor.markSaved();

				expect(editor.deleteFrame("f3")).toBe(false);

				expect(editor.current()).toBe(before);
				expect(editor.isDirty()).toBe(false);
			});

			it("throws for an unknown frame id", () => {
				expect(() => editor.deleteFrame("missing")).toThrow(/no frame/);
			});

			it("drops the deleted frame's history", () => {
				editor.selectFrame("f2");
				editor.moveElement("p1", 1, 1);
				editor.selectFrame("f1");

				editor.deleteFrame("f2");

				expect(editor["histories"].has("f2")).toBe(false);
			});

			it("keeps the remaining frames' histories and shows the new active frame's history", () => {
				editor.moveElement("p1", 1, 1);
				editor.selectFrame("f2");

				editor.deleteFrame("f2");

				expect(activeId()).toBe("f1");
				expect(get(editor.history).canUndo).toBe(true);
			});

			it("is not undoable", () => {
				editor.moveElement("p1", 1, 1);
				editor.deleteFrame("f2");

				editor.undo();
				editor.undo();

				expect(order()).toEqual(["f1", "f3"]);
			});

			it("marks the situation dirty and refreshes updatedAt", () => {
				clock.set(LATER);

				editor.deleteFrame("f2");

				expect(editor.isDirty()).toBe(true);
				expect(editor.current().updatedAt).toBe(LATER);
			});
		});

		describe("moveFrame", () => {
			it("reorders the frames and keeps the same frame active", () => {
				editor.selectFrame("f1");

				editor.moveFrame("f1", 2);

				expect(order()).toEqual(["f2", "f3", "f1"]);
				expect(activeId()).toBe("f1");
			});

			it("keeps the active frame when another frame is moved past it", () => {
				editor.selectFrame("f2");

				editor.moveFrame("f3", 0);

				expect(order()).toEqual(["f3", "f1", "f2"]);
				expect(activeId()).toBe("f2");
			});

			it("is not an undo step and keeps the histories", () => {
				editor.moveElement("p1", 1, 1);

				editor.moveFrame("f1", 1);

				expect(get(editor.history)).toMatchObject({ canUndo: true, undoLabel: "Move Player" });
			});

			it("marks dirty and refreshes updatedAt only when the order changes", () => {
				clock.set(LATER);

				editor.moveFrame("f2", 1);
				expect(editor.isDirty()).toBe(false);
				expect(editor.current().updatedAt).toBe(START);

				editor.moveFrame("f2", 0);
				expect(editor.isDirty()).toBe(true);
				expect(editor.current().updatedAt).toBe(LATER);
			});

			it("throws for an unknown frame id", () => {
				expect(() => editor.moveFrame("missing", 0)).toThrow(/no frame/);
			});
		});

		describe("changeTitle / changeDescription", () => {
			it("change the situation's title and description", () => {
				editor.changeTitle("Powerplay");
				editor.changeDescription("**Notes**");

				expect(editor.current()).toMatchObject({ title: "Powerplay", description: "**Notes**" });
			});

			it("store a blank title as typed (the UI shows the default title)", () => {
				editor.changeTitle("");

				expect(editor.current().title).toBe("");
				expect(editor.current().displayTitle).toBe(DEFAULT_SITUATION_TITLE);
			});

			it("are not undoable and don't touch any history", () => {
				editor.changeTitle("Powerplay");
				editor.changeDescription("Notes");

				expect(get(editor.history)).toEqual(EMPTY_HISTORY_STATUS);
				editor.undo();
				expect(editor.current()).toMatchObject({ title: "Powerplay", description: "Notes" });
			});

			it("mark the situation dirty and refresh updatedAt", () => {
				clock.set(LATER);

				editor.changeTitle("Powerplay");

				expect(editor.isDirty()).toBe(true);
				expect(editor.current().updatedAt).toBe(LATER);

				editor.markSaved();
				editor.changeDescription("Notes");
				expect(editor.isDirty()).toBe(true);
			});

			it("change nothing when the text is the same", () => {
				const before = editor.current();

				editor.changeTitle("Three");
				editor.changeDescription("");

				expect(editor.current()).toBe(before);
				expect(editor.isDirty()).toBe(false);
			});

			it("keep the active frame", () => {
				editor.selectFrame("f2");

				editor.changeTitle("Powerplay");

				expect(activeId()).toBe("f2");
			});
		});

		describe("changeFrameDescription", () => {
			it("changes only the active frame's description", () => {
				editor.selectFrame("f2");

				editor.changeFrameDescription("new");

				expect(editor.current().frames.map((frame) => frame.description)).toEqual(["first", "new", "third"]);
			});

			it("one edit session (until endGesture) is one undo step", () => {
				editor.changeFrameDescription("f");
				editor.changeFrameDescription("fi");
				editor.changeFrameDescription("fir");
				editor.endGesture();
				editor.changeFrameDescription("fire");

				editor.undo();
				expect(editor.currentFrame().description).toBe("fir");
				editor.undo();
				expect(editor.currentFrame().description).toBe("first");
				expect(get(editor.history).canUndo).toBe(false);
			});

			it("switching frames seals the edit session", () => {
				editor.changeFrameDescription("a");
				editor.selectFrame("f2");
				editor.selectFrame("f1");

				editor.changeFrameDescription("ab");
				editor.undo();

				expect(editor.currentFrame().description).toBe("a");
			});

			it("goes into the active frame's history only", () => {
				editor.changeFrameDescription("x");

				editor.selectFrame("f2");
				expect(get(editor.history).canUndo).toBe(false);
				editor.selectFrame("f1");
				expect(get(editor.history)).toMatchObject({ canUndo: true, undoLabel: "Change frame description" });
			});

			it("marks dirty and refreshes updatedAt; the same text is no change", () => {
				editor.changeFrameDescription("first");
				expect(editor.isDirty()).toBe(false);

				clock.set(LATER);
				editor.changeFrameDescription("other");
				expect(editor.isDirty()).toBe(true);
				expect(editor.current().updatedAt).toBe(LATER);
			});
		});

		it("the export contains the title, descriptions and frame order", () => {
			editor.changeTitle("Breakout");
			editor.changeDescription("Situation *notes*");
			editor.selectFrame("f2");
			editor.changeFrameDescription("Frame two notes");
			const added = editor.addFrame();
			editor.moveFrame("f1", 3);

			const file = JSON.parse(new SituationSerializer().serialize(editor.current()));

			expect(file.situation.title).toBe("Breakout");
			expect(file.situation.description).toBe("Situation *notes*");
			expect(file.situation.frames.map((frame: { id: string }) => frame.id)).toEqual(["f2", added, "f3", "f1"]);
			expect(file.situation.frames.map((frame: { description: string }) => frame.description)).toEqual([
				"Frame two notes",
				"Frame two notes",
				"third",
				"first",
			]);
		});

		it("the export round-trips through import with order and descriptions", () => {
			editor.addFrame();
			editor.changeFrameDescription("copy");
			const serializer = new SituationSerializer();

			const imported = serializer.deserialize(serializer.serialize(editor.current()));

			expect(imported.frames.map((frame) => frame.id)).toEqual(editor.current().frames.map((frame) => frame.id));
			expect(imported.frames.map((frame) => frame.description)).toEqual(["first", "copy", "second", "third"]);
		});
	});

	it("exports a shared singleton instance", () => {
		expect(situationEditor).toBeInstanceOf(SituationEditor);
	});

	describe("arrows", () => {
		const A = { x: 100, y: 100 };
		const B = { x: 500, y: 100 };

		function arrow(id: string): ArrowElement {
			return get(editor.elements).find((element) => element.id === id) as ArrowElement;
		}

		function history(): HistoryStatus {
			return get(editor.history);
		}

		it("addArrow adds a straight arrow on top and returns its id; one undo step", () => {
			editor.addElement(0, 0, "red", "Player");
			clock.set("2026-01-01T10:00:00.000Z");

			const id = editor.addArrow(A, B, "black", "Pass");

			const elements = get(editor.elements);
			expect(elements.at(-1)).toBeInstanceOf(ArrowElement);
			expect(elements.at(-1)).toMatchObject({ id, type: "Pass", color: "black", start: A, end: B, bends: [] });
			expect(history().undoLabel).toBe("Add Pass");
			expect(editor.current().updatedAt).toBe("2026-01-01T10:00:00.000Z");
			expect(editor.isDirty()).toBe(true);

			editor.undo();
			expect(get(editor.elements)).toHaveLength(1);
		});

		it("reshapeArrow merges a gesture into one undo step", () => {
			const id = editor.addArrow(A, B, "black", "Run");
			editor.endGesture();
			const first = ArrowGeometry.straight(A, B).withBendInserted(0, { x: 300, y: 200 });

			editor.reshapeArrow(id, first);
			editor.reshapeArrow(id, first.withBendMoved(0, { x: 300, y: 250 }));
			editor.endGesture();

			expect(arrow(id).bends).toEqual([{ x: 300, y: 250 }]);
			expect(history().undoLabel).toBe("Reshape Run");
			editor.undo();
			expect(arrow(id).bends).toEqual([]);
			expect(history().undoLabel).toBe("Add Run");
		});

		it("moveArrow moves the whole arrow and keeps its shape", () => {
			const id = editor.addArrow(A, B, "black", "Pass");
			editor.addBend(id, 0, { x: 300, y: 300 });

			editor.moveArrow(id, 10, -20);

			expect(arrow(id).geometry.points).toEqual([
				{ x: 110, y: 80 },
				{ x: 310, y: 280 },
				{ x: 510, y: 80 },
			]);
			expect(history().undoLabel).toBe("Move Pass");
		});

		it("addBend, removeBend and straightenArrow are undo steps of their own", () => {
			const id = editor.addArrow(A, B, "black", "Shot");
			editor.reshapeArrow(id, ArrowGeometry.straight(A, { x: 600, y: 100 }));

			editor.addBend(id, 0, { x: 200, y: 200 });
			editor.addBend(id, 1, { x: 400, y: 200 });
			editor.removeBend(id, 0);
			editor.straightenArrow(id);

			expect(arrow(id).bends).toEqual([]);
			expect(history().undoLabel).toBe("Straighten Shot");
			editor.undo();
			expect(arrow(id).bends).toEqual([{ x: 400, y: 200 }]);
			expect(history().undoLabel).toBe("Remove bend from Shot");
			editor.undo();
			expect(arrow(id).bends).toEqual([{ x: 200, y: 200 }, { x: 400, y: 200 }]);
			editor.undo();
			expect(arrow(id).bends).toEqual([{ x: 200, y: 200 }]);
			expect(history().undoLabel).toBe("Add bend to Shot");
			editor.undo();
			expect(arrow(id).bends).toEqual([]);
			expect(arrow(id).end).toEqual({ x: 600, y: 100 });
		});

		it("a following drag doesn't merge into a discrete step", () => {
			const id = editor.addArrow(A, B, "black", "Pass");
			editor.addBend(id, 0, { x: 200, y: 200 });

			editor.reshapeArrow(id, arrow(id).geometry.withBendMoved(0, { x: 250, y: 250 }));

			editor.undo();
			expect(arrow(id).bends).toEqual([{ x: 200, y: 200 }]);
		});

		it("straightening a straight arrow and removing an unknown bend record nothing", () => {
			const id = editor.addArrow(A, B, "black", "Pass");
			clock.set("2026-06-01T00:00:00.000Z");

			editor.straightenArrow(id);
			editor.removeBend(id, 0);
			editor.removeBend(id, -1);

			expect(history().undoLabel).toBe("Add Pass");
			expect(editor.current().updatedAt).toBe(START);
		});

		it("arrow methods ignore unknown ids and point elements", () => {
			const player = editor.addElement(0, 0, "red", "Player");
			const before = editor.current();

			for (const id of ["missing", player]) {
				editor.reshapeArrow(id, ArrowGeometry.straight(A, B));
				editor.moveArrow(id, 1, 1);
				editor.addBend(id, 0, A);
				editor.removeBend(id, 0);
				editor.straightenArrow(id);
			}

			expect(editor.current()).toBe(before);
		});

		it("point-only methods ignore arrows", () => {
			const id = editor.addArrow(A, B, "black", "Pass");
			const before = editor.current();

			editor.moveElement(id, 1, 1);
			editor.changeLabel(id, "C");

			expect(editor.current()).toBe(before);
		});

		it("changeColor recolors an arrow", () => {
			const id = editor.addArrow(A, B, "black", "Pass");

			editor.changeColor(id, "red");

			expect(arrow(id).color).toBe("red");
		});

		it("changeType changes types within a family only", () => {
			const id = editor.addArrow(A, B, "black", "Pass");
			const player = editor.addElement(0, 0, "red", "Player");

			editor.changeType(id, "Shot");
			editor.changeType(id, "Circle");
			editor.changeType(player, "Run");
			editor.changeType(player, "Triangle");

			expect(arrow(id).type).toBe("Shot");
			expect(get(editor.elements).find((element) => element.id === player)?.type).toBe("Triangle");
			expect(history().undoLabel).toBe("Change Player to Triangle");
			editor.undo();
			expect(history().undoLabel).toBe("Change Pass to Shot");
		});

		it("arrow edits are undone per frame; a new frame copies the arrows", () => {
			const id = editor.addArrow(A, B, "black", "Pass");
			const copy = editor.addFrame();
			editor.addBend(id, 0, { x: 300, y: 300 });

			expect(arrow(id).bends).toHaveLength(1);
			editor.selectFrame(get(editor.situation).frames[0].id);
			expect(arrow(id).bends).toHaveLength(0);
			expect(get(editor.history).canUndo).toBe(true);
			editor.selectFrame(copy);
			editor.undo();
			expect(arrow(id).bends).toHaveLength(0);
			expect(get(editor.history).canUndo).toBe(false);
		});

		it("arrows survive an export/import round trip", () => {
			const id = editor.addArrow(A, B, "black", "Run");
			editor.addBend(id, 0, { x: 300, y: 300 });
			const serializer = new SituationSerializer();

			const restored = serializer.deserialize(serializer.serialize(editor.current()));

			expect(restored.frames[0].findElement(id)).toEqual(arrow(id));
		});
	});
});
