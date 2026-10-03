import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { FixedClock } from "$lib/model/Clock";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { FrameWorkflow, deleteFrameRequest } from "./FrameWorkflow";
import { SituationEditor } from "./SituationEditor";

function threeFrames(): Situation {
	return new Situation({
		id: "s",
		title: "S",
		description: "",
		sport: "floorball",
		fieldType: "full",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: [new Frame("f1", "", []), new Frame("f2", "", []), new Frame("f3", "", [])],
	});
}

describe("FrameWorkflow", () => {
	let editor: SituationEditor;
	let confirm: ReturnType<typeof vi.fn<(request: unknown) => Promise<boolean>>>;
	let beforeFrameSwitch: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string) => void>> };
	let workflow: FrameWorkflow;

	const order = () => editor.current().frames.map((frame) => frame.id);
	const activeId = () => get(editor.activeFrame).id;
	const messages = () => log.notify.mock.calls.map((call) => call[0]);

	beforeEach(() => {
		editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock(), threeFrames());
		confirm = vi.fn(async () => true);
		beforeFrameSwitch = vi.fn();
		log = { notify: vi.fn<(message: string) => void>() };
		workflow = new FrameWorkflow({ editor, confirm, beforeFrameSwitch, log });
	});

	describe("select", () => {
		it("switches the active frame after resetting the board state", () => {
			beforeFrameSwitch.mockImplementation(() => expect(activeId()).toBe("f1"));

			workflow.select("f3");

			expect(activeId()).toBe("f3");
			expect(beforeFrameSwitch).toHaveBeenCalledOnce();
			expect(messages()).toEqual(["Frame 3"]);
		});

		it("does nothing for the already active frame", () => {
			workflow.select("f1");

			expect(beforeFrameSwitch).not.toHaveBeenCalled();
			expect(messages()).toEqual([]);
		});
	});

	describe("add", () => {
		it("adds a copy after the active frame, resets the board state and logs the new number", () => {
			workflow.select("f2");
			beforeFrameSwitch.mockClear();

			workflow.add();

			expect(order()).toHaveLength(4);
			expect(order().indexOf(activeId())).toBe(2);
			expect(beforeFrameSwitch).toHaveBeenCalledOnce();
			expect(messages()).toContain("Added frame 3");
		});
	});

	describe("delete", () => {
		it("asks for confirmation with the frame number, then deletes", async () => {
			await expect(workflow.delete("f2")).resolves.toBe(true);

			expect(confirm).toHaveBeenCalledWith(deleteFrameRequest(2));
			expect(order()).toEqual(["f1", "f3"]);
			expect(messages()).toContain("Deleted frame 2");
		});

		it("keeps the frame when the user cancels", async () => {
			confirm.mockResolvedValue(false);

			await expect(workflow.delete("f2")).resolves.toBe(false);

			expect(order()).toEqual(["f1", "f2", "f3"]);
			expect(beforeFrameSwitch).not.toHaveBeenCalled();
		});

		it("resets the board state when the active frame is deleted", async () => {
			workflow.select("f2");
			beforeFrameSwitch.mockClear();

			await workflow.delete("f2");

			expect(beforeFrameSwitch).toHaveBeenCalledOnce();
			expect(activeId()).toBe("f1");
		});

		it("keeps the board state when another frame is deleted", async () => {
			await workflow.delete("f3");

			expect(beforeFrameSwitch).not.toHaveBeenCalled();
			expect(activeId()).toBe("f1");
		});

		it("does not ask for the last remaining frame", async () => {
			editor.load(new Situation({ ...threeFrames(), frames: [new Frame("only", "", [])] }));

			await expect(workflow.delete("only")).resolves.toBe(false);

			expect(confirm).not.toHaveBeenCalled();
			expect(order()).toEqual(["only"]);
		});

		it("ignores an unknown frame id", async () => {
			await expect(workflow.delete("missing")).resolves.toBe(false);

			expect(confirm).not.toHaveBeenCalled();
		});

		it("the request is a destructive yes/no question", () => {
			expect(deleteFrameRequest(4)).toEqual({
				title: "Delete frame?",
				message: "Frame 4 and everything on it will be deleted. This can't be undone.",
				confirmLabel: "Delete",
				cancelLabel: "Cancel",
			});
		});
	});

	describe("move", () => {
		it("reorders, keeps the active frame and logs the positions", () => {
			workflow.move("f1", 2);

			expect(order()).toEqual(["f2", "f3", "f1"]);
			expect(activeId()).toBe("f1");
			expect(beforeFrameSwitch).not.toHaveBeenCalled();
			expect(messages()).toEqual(["Moved frame 1 to position 3"]);
		});

		it("logs nothing when the position doesn't change", () => {
			workflow.move("f2", 1);

			expect(messages()).toEqual([]);
		});
	});
});
