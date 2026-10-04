import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import { Frame } from "$lib/model/Frame";
import { Situation } from "$lib/model/Situation";
import { summaryOf } from "$lib/testing/storageFakes";
import { SavedSituationActions } from "./SavedSituationActions";
import type { SituationSummary } from "./SituationApi";
import type { OpenOutcome } from "./SituationOpener";

const powerplay = summaryOf({ id: "s1", title: "Powerplay" });
const opened = new Situation({
	id: "s1",
	title: "Powerplay",
	description: "",
	sport: "floorball",
	fieldType: "full",
	createdAt: "2026-10-04T08:00:00.000Z",
	updatedAt: "2026-10-04T08:00:00.000Z",
	frames: [new Frame("f1", "", [])],
});

describe("SavedSituationActions", () => {
	let list: {
		load: ReturnType<typeof vi.fn<() => Promise<void>>>;
		delete: ReturnType<typeof vi.fn<(situation: SituationSummary) => Promise<boolean>>>;
		move: ReturnType<typeof vi.fn<(situation: SituationSummary, folderId: string | null) => Promise<boolean>>>;
	};
	let outcome: OpenOutcome;
	let opener: { open: ReturnType<typeof vi.fn<(id: string, confirmDiscard: () => Promise<boolean>) => Promise<OpenOutcome>>> };
	let confirmDiscard: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
	let confirm: ReturnType<typeof vi.fn<(request: ConfirmationRequest) => Promise<boolean>>>;
	let navigate: ReturnType<typeof vi.fn<(url: string) => Promise<unknown>>>;
	let actions: SavedSituationActions;

	beforeEach(() => {
		list = { load: vi.fn(async () => undefined), delete: vi.fn(async () => true), move: vi.fn(async () => true) };
		outcome = { status: "opened", situation: opened };
		opener = { open: vi.fn(async () => outcome) };
		confirmDiscard = vi.fn(async () => true);
		confirm = vi.fn(async () => true);
		navigate = vi.fn(async () => undefined);
		actions = new SavedSituationActions({ list, opener, confirmDiscard, confirm, navigate });
	});

	describe("open", () => {
		it("opens the situation (asking to discard changes through the workflow) and goes to the editor", async () => {
			await actions.open(powerplay);

			expect(opener.open).toHaveBeenCalledWith("s1", confirmDiscard);
			expect(navigate).toHaveBeenCalledWith("/editor?situation=s1");
			expect(actions.current()).toEqual({ opening: false, error: null });
		});

		it("is busy while opening", async () => {
			let finish: (value: OpenOutcome) => void = () => undefined;
			opener.open.mockReturnValue(new Promise((resolve) => (finish = resolve)));

			const opening = actions.open(powerplay);
			expect(actions.current().opening).toBe(true);
			finish({ status: "cancelled" });
			await opening;

			expect(actions.current().opening).toBe(false);
		});

		it("stays when the user keeps the unsaved changes", async () => {
			outcome = { status: "cancelled" };

			await actions.open(powerplay);

			expect(navigate).not.toHaveBeenCalled();
			expect(actions.current().error).toBeNull();
		});

		it("shows why it couldn't be opened and reloads the list", async () => {
			outcome = { status: "failed", message: "This situation no longer exists." };

			await actions.open(powerplay);

			expect(actions.current()).toEqual({ opening: false, error: '"Powerplay" couldn\'t be opened. This situation no longer exists.' });
			expect(list.load).toHaveBeenCalledOnce();
			expect(navigate).not.toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("asks “Delete situation?” and deletes", async () => {
			await expect(actions.delete(powerplay)).resolves.toBe(true);

			expect(confirm).toHaveBeenCalledWith({
				title: "Delete situation?",
				message: "“Powerplay” will be deleted.",
				confirmLabel: "Delete",
				cancelLabel: "Cancel",
			});
			expect(list.delete).toHaveBeenCalledWith(powerplay);
		});

		it("keeps the situation when cancelled", async () => {
			confirm.mockResolvedValue(false);

			await expect(actions.delete(powerplay)).resolves.toBe(false);
			expect(list.delete).not.toHaveBeenCalled();
		});

		it("clears an earlier open failure", async () => {
			outcome = { status: "failed", message: "Gone." };
			await actions.open(powerplay);

			await actions.delete(powerplay);

			expect(actions.current().error).toBeNull();
		});
	});

	describe("move", () => {
		it("moves through the list", async () => {
			await expect(actions.move(powerplay, "f1")).resolves.toBe(true);

			expect(list.move).toHaveBeenCalledWith(powerplay, "f1");
		});

		it("passes on a failed move and clears an earlier open failure", async () => {
			outcome = { status: "failed", message: "Gone." };
			await actions.open(powerplay);
			list.move.mockResolvedValue(false);

			await expect(actions.move(powerplay, null)).resolves.toBe(false);
			expect(actions.current().error).toBeNull();
		});
	});
});
