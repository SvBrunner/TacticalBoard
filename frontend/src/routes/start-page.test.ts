import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { goto } from "$app/navigation";
import { situationEditor } from "$lib/editor/SituationEditor";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { Frame } from "$lib/model/Frame";
import { Situation } from "$lib/model/Situation";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import StartPage from "./+page.svelte";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => undefined) }));

function situationFile(name = "play.situation.json"): File {
	const situation = new Situation({
		id: "original",
		title: "Breakout",
		description: "",
		sport: "floorball",
		fieldType: "half",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: [new Frame("f1", "", [])],
	});
	return new File([new SituationSerializer().serialize(situation)], name, { type: "application/json" });
}

async function chooseFile(container: HTMLElement, file: File) {
	const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	await fireEvent.change(input);
}

/** Lets the async import (file read, confirmation) finish. */
async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("start page", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
		vi.mocked(goto).mockClear();
		situationEditor.createNew({ title: "Reset", fieldType: "full" });
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	describe("semantics", () => {
		it("is the main landmark with the app name as h1", () => {
			render(StartPage);

			const main = screen.getByRole("main");
			expect(within(main).getByRole("heading", { level: 1, name: "Tactical Board" })).toBeInTheDocument();
		});

		it("offers New situation and Import as buttons", () => {
			render(StartPage);

			const start = screen.getByRole("region", { name: "Start" });
			const buttons = within(start).getAllByRole("button");
			expect(buttons.map((b) => b.textContent?.trim())).toEqual(["New situation", "Import"]);
			expect(buttons.every((b) => b.getAttribute("type") === "button")).toBe(true);
			expect(within(start).getByRole("list")).toBeInTheDocument();
		});

		it("has a Saved situations section with a neutral empty state (storage comes later)", () => {
			render(StartPage);

			const saved = screen.getByRole("region", { name: "Saved situations" });
			expect(within(saved).getByRole("heading", { level: 2 })).toHaveTextContent("Saved situations");
			expect(saved).toHaveTextContent("Saved situations will appear here once storage is available.");
		});

		it("hides decorative icons from assistive technology", () => {
			const { container } = render(StartPage);

			for (const svg of container.querySelectorAll("svg")) {
				expect(svg.closest("[aria-hidden='true']")).not.toBeNull();
			}
		});
	});

	describe("New situation", () => {
		it("opens the New situation dialog", async () => {
			render(StartPage);

			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			expect(screen.getByRole("dialog", { name: "New situation" })).toHaveAttribute("open");
		});

		it("creating a situation opens the editor with it", async () => {
			render(StartPage);
			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			await fireEvent.input(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Powerplay" } });
			await fireEvent.click(screen.getByRole("radio", { name: /half/i }));
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));

			expect(situationEditor.current()).toMatchObject({ title: "Powerplay", fieldType: "half" });
			expect(goto).toHaveBeenCalledWith("/editor");
		});

		it("cancelling stays on the start page", async () => {
			const before = situationEditor.current();
			render(StartPage);
			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(situationEditor.current()).toBe(before);
			expect(goto).not.toHaveBeenCalled();
		});

		it("asks to discard unsaved changes first (e.g. after going back from the editor)", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(StartPage);

			await fireEvent.click(screen.getByRole("button", { name: "New situation" }));
			await settle();

			expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
		});
	});

	describe("Import", () => {
		it("the Import button opens the file picker", async () => {
			const { container } = render(StartPage);
			const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
			const click = vi.spyOn(input, "click");

			await fireEvent.click(screen.getByRole("button", { name: "Import" }));

			expect(click).toHaveBeenCalledOnce();
			expect(input).toHaveAttribute("accept", ".json");
		});

		it("importing a valid file opens the editor with it", async () => {
			const { container } = render(StartPage);

			await chooseFile(container, situationFile());
			await settle();

			expect(situationEditor.current()).toMatchObject({ title: "Breakout", fieldType: "half" });
			expect(situationEditor.current().id).not.toBe("original");
			expect(goto).toHaveBeenCalledWith("/editor");
		});

		it("an invalid file stays on the start page", async () => {
			const before = situationEditor.current();
			const { container } = render(StartPage);

			await chooseFile(container, new File(["{nope"], "broken.json"));
			await settle();

			expect(situationEditor.current()).toBe(before);
			expect(goto).not.toHaveBeenCalled();
		});

		it("resets the file input so the same file can be chosen again", async () => {
			const { container } = render(StartPage);
			const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
			input.value = "";
			const setter = vi.spyOn(input, "value", "set");

			await chooseFile(container, situationFile());
			await settle();

			expect(setter).toHaveBeenCalledWith("");
		});
	});
});
