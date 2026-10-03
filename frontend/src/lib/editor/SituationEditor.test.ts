import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { FixedClock } from "$lib/model/Clock";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { DEFAULT_SITUATION_TITLE, Situation } from "$lib/model/Situation";
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

	it("exports a shared singleton instance", () => {
		expect(situationEditor).toBeInstanceOf(SituationEditor);
	});
});
