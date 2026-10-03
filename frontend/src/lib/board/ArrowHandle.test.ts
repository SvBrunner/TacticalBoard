import { describe, it, expect } from "vitest";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { ArrowHandle } from "./ArrowHandle";

const straight = ArrowGeometry.straight({ x: 0, y: 0 }, { x: 400, y: 0 });
const bent = new ArrowGeometry({ x: 0, y: 0 }, { x: 400, y: 0 }, [{ x: 100, y: 100 }, { x: 300, y: 100 }]);

describe("ArrowHandle", () => {
	it("a straight arrow has an add-bend handle, then start and end", () => {
		expect(ArrowHandle.allOf(straight).map((handle) => handle.key)).toEqual(["insert-0", "start-0", "end-0"]);
	});

	it("a bent arrow has an add-bend handle per segment below its start, bend and end handles", () => {
		expect(ArrowHandle.allOf(bent).map((handle) => handle.key)).toEqual([
			"insert-0",
			"insert-1",
			"insert-2",
			"start-0",
			"bend-0",
			"bend-1",
			"end-0",
		]);
	});

	it("tells point handles from add-bend handles", () => {
		expect(ArrowHandle.start().isPoint).toBe(true);
		expect(ArrowHandle.bend(0).isPoint).toBe(true);
		expect(ArrowHandle.end().isPoint).toBe(true);
		expect(ArrowHandle.insert(0).isPoint).toBe(false);
	});

	it("sits on the point it moves, an add-bend handle in the middle of its segment", () => {
		expect(ArrowHandle.start().positionOn(bent)).toEqual({ x: 0, y: 0 });
		expect(ArrowHandle.end().positionOn(bent)).toEqual({ x: 400, y: 0 });
		expect(ArrowHandle.bend(1).positionOn(bent)).toEqual({ x: 300, y: 100 });
		expect(ArrowHandle.insert(1).positionOn(bent)).toEqual(bent.segmentMidpoint(1));
		expect(ArrowHandle.insert(0).positionOn(straight)).toEqual({ x: 200, y: 0 });
	});

	it("dragging start, end or a bend moves that point", () => {
		const to = { x: 50, y: 60 };

		expect(ArrowHandle.start().apply(bent, to).start).toEqual(to);
		expect(ArrowHandle.end().apply(bent, to).end).toEqual(to);
		expect(ArrowHandle.bend(0).apply(bent, to).bends).toEqual([to, { x: 300, y: 100 }]);
	});

	it("dragging an add-bend handle inserts a bend into its segment", () => {
		const to = { x: 200, y: 150 };

		expect(ArrowHandle.insert(0).apply(straight, to).bends).toEqual([to]);
		expect(ArrowHandle.insert(1).apply(bent, to).bends).toEqual([{ x: 100, y: 100 }, to, { x: 300, y: 100 }]);
	});

	it("after a drag, an add-bend handle is the new bend; other handles stay themselves", () => {
		expect(ArrowHandle.insert(1).afterDrag().key).toBe("bend-1");
		expect(ArrowHandle.bend(0).afterDrag().key).toBe("bend-0");
		expect(ArrowHandle.start().afterDrag().key).toBe("start-0");

		const to = { x: 200, y: 150 };
		const handle = ArrowHandle.insert(1);
		expect(handle.afterDrag().positionOn(handle.apply(bent, to))).toEqual(to);
	});

	it("find looks a handle up by its key", () => {
		expect(ArrowHandle.find(bent, "bend-1")?.key).toBe("bend-1");
		expect(ArrowHandle.find(bent, "insert-2")?.kind).toBe("insert");
		expect(ArrowHandle.find(straight, "bend-0")).toBeUndefined();
		expect(ArrowHandle.find(straight, "nonsense")).toBeUndefined();
	});
});
