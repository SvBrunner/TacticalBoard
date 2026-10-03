import { describe, it, expect } from "vitest";
import { FixedClock } from "./Clock";
import { PointElement } from "./elements/PointElement";
import { Frame } from "./Frame";
import { SequentialIdGenerator } from "./ids/IdGenerator";
import { DEFAULT_SITUATION_TITLE, Situation, type SituationProps } from "./Situation";

function props(overrides: Partial<SituationProps> = {}): SituationProps {
	return {
		id: "s",
		title: "Title",
		description: "Description",
		sport: "floorball",
		fieldType: "full",
		frames: [new Frame("f1", "", []), new Frame("f2", "", [])],
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-02T00:00:00.000Z",
		...overrides,
	};
}

describe("Situation", () => {
	describe("create", () => {
		it("creates a situation with one empty frame, default title, and both timestamps set to now", () => {
			const situation = Situation.create(
				{ sport: "floorball", fieldType: "half" },
				new SequentialIdGenerator(),
				new FixedClock("2026-04-01T08:00:00.000Z"),
			);

			expect(situation.id).toBe("id-1");
			expect(situation.title).toBe(DEFAULT_SITUATION_TITLE);
			expect(situation.description).toBe("");
			expect(situation.sport).toBe("floorball");
			expect(situation.fieldType).toBe("half");
			expect(situation.frames).toHaveLength(1);
			expect(situation.frames[0]).toMatchObject({ id: "id-2", description: "", elements: [] });
			expect(situation.createdAt).toBe("2026-04-01T08:00:00.000Z");
			expect(situation.updatedAt).toBe("2026-04-01T08:00:00.000Z");
		});

		it("uses the given title and description", () => {
			const situation = Situation.create(
				{ sport: "floorball", fieldType: "full", title: "Powerplay", description: "Some *text*" },
				new SequentialIdGenerator(),
				new FixedClock(),
			);

			expect(situation.title).toBe("Powerplay");
			expect(situation.description).toBe("Some *text*");
		});

		it("allows an empty title", () => {
			const situation = Situation.create(
				{ sport: "floorball", fieldType: "full", title: "" },
				new SequentialIdGenerator(),
				new FixedClock(),
			);

			expect(situation.title).toBe("");
		});
	});

	it("the default title is 'Untitled Situation'", () => {
		expect(DEFAULT_SITUATION_TITLE).toBe("Untitled Situation");
	});

	it("throws when constructed without frames", () => {
		expect(() => new Situation(props({ frames: [] }))).toThrow(/at least one frame/);
	});

	it("copies the frames array so later changes to the input do not leak in", () => {
		const frames = [new Frame("f1", "", [])];
		const situation = new Situation(props({ frames }));
		frames.push(new Frame("f2", "", []));

		expect(situation.frames).toHaveLength(1);
	});

	describe("displayTitle", () => {
		it("is the title when set", () => {
			expect(new Situation(props({ title: "Breakout" })).displayTitle).toBe("Breakout");
		});

		it.each([[""], ["   "]])("is the default title when the title is %j", (title) => {
			expect(new Situation(props({ title })).displayTitle).toBe(DEFAULT_SITUATION_TITLE);
		});
	});

	describe("setters", () => {
		const situation = new Situation(props());

		it("withTitle keeps the id and everything else", () => {
			const result = situation.withTitle("New");

			expect(result).not.toBe(situation);
			expect(result).toMatchObject({ ...props(), title: "New", frames: situation.frames });
			expect(situation.title).toBe("Title");
		});

		it("withDescription keeps the id and everything else", () => {
			const result = situation.withDescription("New *description*");

			expect(result).toMatchObject({ id: "s", title: "Title", description: "New *description*" });
			expect(situation.description).toBe("Description");
		});

		it("withTitle and withDescription return the same situation when nothing changes", () => {
			expect(situation.withTitle("Title")).toBe(situation);
			expect(situation.withDescription("Description")).toBe(situation);
		});

		it("withUpdatedAt only changes updatedAt", () => {
			const result = situation.withUpdatedAt("2026-09-09T09:09:09.000Z");

			expect(result).toMatchObject({
				id: "s",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-09-09T09:09:09.000Z",
			});
		});

		it("withTimestamps changes both timestamps and nothing else", () => {
			const result = situation.withTimestamps("2026-05-01T00:00:00.000Z", "2026-05-02T00:00:00.000Z");

			expect(result).toMatchObject({
				id: "s",
				title: "Title",
				createdAt: "2026-05-01T00:00:00.000Z",
				updatedAt: "2026-05-02T00:00:00.000Z",
			});
			expect(result.frames).toEqual(situation.frames);
			expect(situation.createdAt).toBe("2026-01-01T00:00:00.000Z");
		});

		it("withId changes only the id", () => {
			const result = situation.withId("other");

			expect(result.id).toBe("other");
			expect(result.frames).toEqual(situation.frames);
			expect(result.title).toBe("Title");
		});

		it("has no setters for sport or field type", () => {
			const prototype = Situation.prototype as unknown as Record<string, unknown>;

			expect(prototype.withSport).toBeUndefined();
			expect(prototype.withFieldType).toBeUndefined();
		});
	});

	describe("frame access", () => {
		const situation = new Situation(props());

		it("frameAt returns the frame at the index", () => {
			expect(situation.frameAt(1)?.id).toBe("f2");
		});

		it("frameAt returns undefined outside the range", () => {
			expect(situation.frameAt(2)).toBeUndefined();
			expect(situation.frameAt(-1)).toBeUndefined();
		});

		it("findFrame finds a frame by id", () => {
			expect(situation.findFrame("f2")).toBe(situation.frames[1]);
		});

		it("findFrame returns undefined for an unknown id", () => {
			expect(situation.findFrame("missing")).toBeUndefined();
		});
	});

	describe("frame order", () => {
		const f1 = new Frame("f1", "", []);
		const f2 = new Frame("f2", "", []);
		const f3 = new Frame("f3", "", []);
		const three = () => new Situation(props({ frames: [f1, f2, f3] }));
		const order = (situation: Situation) => situation.frames.map((frame) => frame.id);

		it("indexOfFrame returns the position, or -1 for an unknown id", () => {
			const situation = three();

			expect(situation.indexOfFrame("f1")).toBe(0);
			expect(situation.indexOfFrame("f3")).toBe(2);
			expect(situation.indexOfFrame("missing")).toBe(-1);
		});

		describe("insertFrame", () => {
			const added = new Frame("new", "", []);

			it.each([
				[0, ["new", "f1", "f2", "f3"]],
				[1, ["f1", "new", "f2", "f3"]],
				[3, ["f1", "f2", "f3", "new"]],
			])("inserts at index %i", (index, expected) => {
				expect(order(three().insertFrame(added, index))).toEqual(expected);
			});

			it.each([
				[-5, ["new", "f1", "f2", "f3"]],
				[99, ["f1", "f2", "f3", "new"]],
				[1.7, ["f1", "new", "f2", "f3"]],
			])("clamps the index %d", (index, expected) => {
				expect(order(three().insertFrame(added, index))).toEqual(expected);
			});

			it("keeps everything else and leaves the original unchanged", () => {
				const situation = three();

				const result = situation.insertFrame(added, 1);

				expect(result).toMatchObject({ id: "s", title: "Title", updatedAt: situation.updatedAt });
				expect(result.findFrame("new")).toBe(added);
				expect(order(situation)).toEqual(["f1", "f2", "f3"]);
			});

			it("throws for a frame id that is already used", () => {
				expect(() => three().insertFrame(new Frame("f2", "", []), 0)).toThrow(/already contains a frame/);
			});
		});

		describe("removeFrame", () => {
			it("removes the frame and keeps the order of the others", () => {
				const situation = three();

				const result = situation.removeFrame("f2");

				expect(order(result)).toEqual(["f1", "f3"]);
				expect(result.frames[0]).toBe(f1);
				expect(order(situation)).toEqual(["f1", "f2", "f3"]);
			});

			it("returns the same situation for an unknown id", () => {
				const situation = three();

				expect(situation.removeFrame("missing")).toBe(situation);
			});

			it("refuses to remove the last remaining frame", () => {
				const single = new Situation(props({ frames: [f1] }));

				expect(() => single.removeFrame("f1")).toThrow(/last frame/);
			});
		});

		describe("moveFrame", () => {
			it.each([
				["f1", 2, ["f2", "f3", "f1"]],
				["f1", 1, ["f2", "f1", "f3"]],
				["f3", 0, ["f3", "f1", "f2"]],
				["f2", 0, ["f2", "f1", "f3"]],
				["f2", 2, ["f1", "f3", "f2"]],
			])("moves %s to index %i", (id, toIndex, expected) => {
				expect(order(three().moveFrame(id, toIndex))).toEqual(expected);
			});

			it("clamps the target index", () => {
				expect(order(three().moveFrame("f2", 99))).toEqual(["f1", "f3", "f2"]);
				expect(order(three().moveFrame("f2", -3))).toEqual(["f2", "f1", "f3"]);
			});

			it("keeps the frame instances", () => {
				const result = three().moveFrame("f1", 2);

				expect(result.frames).toEqual([f2, f3, f1]);
				expect(result.frames[2]).toBe(f1);
			});

			it("returns the same situation for the same position or an unknown id", () => {
				const situation = three();

				expect(situation.moveFrame("f2", 1)).toBe(situation);
				expect(situation.moveFrame("missing", 0)).toBe(situation);
			});
		});
	});

	describe("updateFrame", () => {
		const element = new PointElement("e", 0, 0, "red", "Player");

		it("replaces only the matching frame", () => {
			const situation = new Situation(props());

			const result = situation.updateFrame("f2", (frame) => frame.addElement(element));

			expect(result.id).toBe("s");
			expect(result.frames[0]).toBe(situation.frames[0]);
			expect(result.frames[1].elements).toEqual([element]);
			expect(situation.frames[1].elements).toEqual([]);
		});

		it("does not touch updatedAt (the editor does that)", () => {
			const situation = new Situation(props());

			expect(situation.updateFrame("f1", (frame) => frame.withDescription("x")).updatedAt).toBe(situation.updatedAt);
		});

		it("returns the same situation for an unknown frame id", () => {
			const situation = new Situation(props());

			expect(situation.updateFrame("missing", (frame) => frame.withDescription("x"))).toBe(situation);
		});

		it("returns the same situation when the frame is unchanged", () => {
			const situation = new Situation(props());

			expect(situation.updateFrame("f1", (frame) => frame.removeElement("missing"))).toBe(situation);
		});

		it("throws when the update changes the frame id", () => {
			const situation = new Situation(props());

			expect(() => situation.updateFrame("f1", () => new Frame("other", "", []))).toThrow();
		});
	});
});
