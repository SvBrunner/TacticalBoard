import { describe, it, expect, afterEach } from "vitest";
import Konva from "konva";
import { configureKonva, DRAG_DISTANCE_PX } from "./konvaSetup";

describe("configureKonva", () => {
	const original = Konva.dragDistance;

	afterEach(() => {
		Konva.dragDistance = original;
	});

	it("raises the drag distance so finger jitter doesn't start a drag", () => {
		expect(DRAG_DISTANCE_PX).toBeGreaterThan(3);

		configureKonva();

		expect(Konva.dragDistance).toBe(DRAG_DISTANCE_PX);
	});

	it("configures an injected Konva-like object", () => {
		const fake = { dragDistance: 3 };

		configureKonva(fake);

		expect(fake.dragDistance).toBe(6);
	});

	it("is idempotent", () => {
		configureKonva();
		configureKonva();

		expect(Konva.dragDistance).toBe(DRAG_DISTANCE_PX);
	});
});
