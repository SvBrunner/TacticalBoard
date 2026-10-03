import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { PopoverState } from "./PopoverState";

const rect = { x: 1, y: 2, width: 3, height: 4 };

describe("PopoverState", () => {
	it("starts closed", () => {
		const popover = new PopoverState();

		expect(popover.isOpen()).toBe(false);
		expect(get(popover.anchor)).toBeNull();
	});

	it("open stores the anchor", () => {
		const popover = new PopoverState();

		popover.open(rect);

		expect(popover.isOpen()).toBe(true);
		expect(get(popover.anchor)).toEqual(rect);
	});

	it("close forgets the anchor", () => {
		const popover = new PopoverState();
		popover.open(rect);

		popover.close();

		expect(popover.isOpen()).toBe(false);
		expect(get(popover.anchor)).toBeNull();
	});
});
