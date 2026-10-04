import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
import { SituationEditor } from "$lib/editor/SituationEditor";
import { SituationWorkflow, type SituationFiles } from "$lib/editor/SituationWorkflow";
import { FixedClock } from "$lib/model/Clock";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { inFolder, TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";
import { SituationLink } from "$lib/storage/SituationLink";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import StartActions from "./StartActions.svelte";

const imported = new Situation({
	id: "imported",
	title: "Imported",
	description: "",
	sport: "floorball",
	fieldType: "full",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	frames: [new Frame("f1", "", [])],
});

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("StartActions", () => {
	let restore: () => void;
	let link: SituationLink;
	let workflow: SituationWorkflow;
	let onOpened: ReturnType<typeof vi.fn<() => void>>;

	beforeEach(() => {
		restore = installDialogPolyfill();
		link = new SituationLink();
		const files: SituationFiles = { export: () => "x.json", import: async () => imported };
		const prompt = new ConfirmationPrompt();
		workflow = new SituationWorkflow({
			editor: new SituationEditor(new SequentialIdGenerator(), new FixedClock()),
			files,
			link,
			confirm: (request) => prompt.request(request),
		});
		onOpened = vi.fn();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	function renderAt(target?: SaveTarget) {
		return render(StartActions, { props: { workflow, prompt: new ConfirmationPrompt(), target, onOpened } });
	}

	it("offers New situation and Import as buttons in a list", () => {
		const { container } = renderAt();

		const buttons = screen.getAllByRole("button").filter((button) => !button.closest("dialog"));
		expect(buttons.map((button) => button.textContent?.trim())).toEqual(["New situation", "Import"]);
		expect(buttons.every((button) => button.closest("li") !== null && button.getAttribute("type") === "button")).toBe(true);
		expect(container.querySelector("input[type=file]")).toHaveAttribute("accept", ".json");
		for (const svg of container.querySelectorAll(".actions svg")) {
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});

	it("a new situation is started at the top level by default", async () => {
		renderAt();

		await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
		await settle();
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(onOpened).toHaveBeenCalledOnce();
		expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
	});

	it("a new situation is started in the given folder", async () => {
		renderAt(inFolder("f1"));

		await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
		await settle();
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: { folderId: "f1" } });
	});

	it("Import opens the file picker and imports into the given folder, resetting the input", async () => {
		const { container } = renderAt(inFolder("f1"));
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		const click = vi.spyOn(input, "click");

		await fireEvent.click(screen.getByRole("button", { name: "Import" }));
		expect(click).toHaveBeenCalledOnce();

		Object.defineProperty(input, "files", { value: [new File(["{}"], "x.json")], configurable: true });
		await fireEvent.change(input);
		await settle();

		expect(onOpened).toHaveBeenCalledOnce();
		expect(link.current()).toEqual({ kind: "unsaved", origin: "imported", target: { folderId: "f1" } });
		expect(input.value).toBe("");
	});

	it("ignores an empty file choice", async () => {
		const { container } = renderAt();
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;

		Object.defineProperty(input, "files", { value: [], configurable: true });
		await fireEvent.change(input);
		await settle();

		expect(onOpened).not.toHaveBeenCalled();
	});
});
