import { describe, it, expect } from "vitest";
import { EMPTY_HISTORY_STATUS, sameHistoryStatus } from "./HistoryStatus";

describe("HistoryStatus", () => {
	it("the empty status allows neither undo nor redo", () => {
		expect(EMPTY_HISTORY_STATUS).toEqual({ canUndo: false, canRedo: false, undoLabel: undefined, redoLabel: undefined });
	});

	it("sameHistoryStatus compares all fields", () => {
		const status = { canUndo: true, canRedo: true, undoLabel: "a", redoLabel: "b" };

		expect(sameHistoryStatus(status, { ...status })).toBe(true);
		expect(sameHistoryStatus(status, { ...status, canUndo: false })).toBe(false);
		expect(sameHistoryStatus(status, { ...status, canRedo: false })).toBe(false);
		expect(sameHistoryStatus(status, { ...status, undoLabel: "x" })).toBe(false);
		expect(sameHistoryStatus(status, { ...status, redoLabel: "x" })).toBe(false);
	});
});
