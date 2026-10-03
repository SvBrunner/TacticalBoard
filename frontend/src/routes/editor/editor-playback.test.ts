import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import Konva from "konva";
import { notifications } from "$lib/debug/Notifications";
import { situationEditor } from "$lib/editor/SituationEditor";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { PlaybackSettingsStore } from "$lib/playback/PlaybackSettings";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";
import { ARROW_DRAFT_NODE_NAME, ELEMENT_NODE_NAME } from "$lib/components/board/Shapes";
import type { Shape } from "konva/lib/Shape";
import EditorPage from "./+page.svelte";

vi.mock("$app/navigation", () => ({ goto: vi.fn(async () => undefined) }));

/** Lets pending promise continuations and the resulting DOM updates run. */
async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

const strip = () => screen.getByRole("navigation", { name: "Frames" });
const controls = () => screen.getByRole("region", { name: "Playback" });
const control = (name: string) => within(controls()).getByRole("button", { name });
const frameButton = (number: number) => within(strip()).getByRole("button", { name: `Frame ${number}` });
const currentFrameNumber = () => {
	const current = strip().querySelector('[aria-current="step"]');
	return current ? within(current as HTMLElement).getByText(/^Frame \d+$/).textContent : null;
};
const stage = () => Konva.stages[Konva.stages.length - 1];
const shownElementCount = () => stage().find(`.${ELEMENT_NODE_NAME}`).length;
const status = () => within(controls()).getByText("Frame").closest("p")!.textContent!.replace(/\s+/g, " ").trim();

async function showBoard() {
	render(EditorPage);
	FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500); // scale 0.5
	await tick();
}

async function advance(ms: number) {
	vi.advanceTimersByTime(ms);
	await tick();
}

function pointer(clientX: number, clientY: number) {
	return { button: 0, shiftKey: false, pointerType: "touch", pointerId: 1, clientX, clientY, preventDefault: () => {} };
}

describe("editor page: slideshow playback", () => {
	let restoreDialog: () => void;
	let restoreCanvas: () => void;
	let playerId: string;
	let frameIds: string[];

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
		restoreDialog = installDialogPolyfill();
		restoreCanvas = installFakeCanvasContext();
		FakeResizeObserver.reset();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
		localStorage.clear();
		notifications.clear();

		// Three frames with 1, 2 and 3 point elements; frame 2 is active.
		situationEditor.createNew({ title: "Breakout", fieldType: "full" });
		playerId = situationEditor.addElement(500, 250, "red", "Player");
		situationEditor.addFrame();
		situationEditor.addElement(700, 250, "grey", "Ball");
		situationEditor.addFrame();
		situationEditor.addElement(900, 250, "grey", "Triangle");
		frameIds = situationEditor.current().frames.map((frame) => frame.id);
		situationEditor.selectFrame(frameIds[1]);
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		restoreCanvas();
		restoreDialog();
		localStorage.clear();
	});

	it("shows the playback controls below the board with the active frame", async () => {
		await showBoard();

		expect(within(screen.getByRole("main")).getByRole("region", { name: "Playback" })).toBeInTheDocument();
		expect(control("Play")).toBeEnabled();
		expect(control("Stop")).toBeDisabled();
		expect(status()).toBe("Frame 2 / 3");
	});

	it("Play is disabled with only one frame", async () => {
		situationEditor.createNew({ title: "Single", fieldType: "full" });
		await showBoard();

		expect(control("Play")).toBeDisabled();
		await fireEvent.keyDown(document.body, { key: " " });
		expect(control("Play")).toBeDisabled();
		expect(control("Stop")).toBeDisabled();
	});

	describe("Play", () => {
		it("starts at frame 1, highlights it in the strip and shows its elements", async () => {
			await showBoard();
			expect(shownElementCount()).toBe(2);

			await fireEvent.click(control("Play"));

			expect(currentFrameNumber()).toBe("Frame 1");
			expect(status()).toBe("Frame 1 / 3");
			expect(shownElementCount()).toBe(1);
			expect(control("Pause")).toBeEnabled();
			// The model's active frame doesn't change.
			expect(get(situationEditor.activeFrame).id).toBe(frameIds[1]);
		});

		it("advances every 2 seconds by default (hard cut) and stops after the last frame", async () => {
			await showBoard();
			await fireEvent.click(control("Play"));

			await advance(1999);
			expect(currentFrameNumber()).toBe("Frame 1");
			await advance(1);
			expect(currentFrameNumber()).toBe("Frame 2");
			expect(shownElementCount()).toBe(2);
			await advance(2000);
			expect(currentFrameNumber()).toBe("Frame 3");
			expect(shownElementCount()).toBe(3);

			await advance(2000);
			// Back to the frame that was active before playback.
			expect(control("Play")).toBeEnabled();
			expect(control("Stop")).toBeDisabled();
			expect(currentFrameNumber()).toBe("Frame 2");
			expect(shownElementCount()).toBe(2);
		});

		it("loops when Loop is on", async () => {
			await showBoard();
			await fireEvent.click(control("Loop"));
			await fireEvent.click(control("Play"));

			await advance(6000);

			expect(currentFrameNumber()).toBe("Frame 1");
			expect(control("Pause")).toBeEnabled();
		});

		it("uses the chosen frame duration and remembers it in the browser", async () => {
			await showBoard();
			await fireEvent.change(within(controls()).getByRole("combobox", { name: "Frame duration" }), { target: { value: "1000" } });
			await fireEvent.click(control("Play"));

			await advance(1000);

			expect(currentFrameNumber()).toBe("Frame 2");
			expect(JSON.parse(localStorage.getItem(PlaybackSettingsStore.STORAGE_KEY)!)).toEqual({ frameDurationMs: 1000, loop: false });
		});

		it("starts with the settings remembered in the browser", async () => {
			localStorage.setItem(PlaybackSettingsStore.STORAGE_KEY, JSON.stringify({ frameDurationMs: 5000, loop: true }));
			await showBoard();

			expect((within(controls()).getByRole("combobox", { name: "Frame duration" }) as HTMLSelectElement).value).toBe("5000");
			expect(control("Loop")).toHaveAttribute("aria-pressed", "true");
		});

		it("closes the popover and clears the selection", async () => {
			await showBoard();
			situationEditor.selectFrame(frameIds[0]);
			await tick();
			stage().findOne(`#${playerId}`)!.fire("pointerclick", { evt: pointer(250, 125) }, true);
			await tick();
			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBeInTheDocument();

			await fireEvent.click(control("Play"));
			await fireEvent.click(control("Stop"));

			expect(screen.queryByRole("dialog", { name: "Edit marker" })).not.toBeInTheDocument();
			expect((stage().findOne(`#${playerId}`) as Shape).strokeWidth()).toBe(0);
		});

		it("drops an arrow being drawn", async () => {
			await showBoard();
			await fireEvent.click(within(screen.getByRole("complementary", { name: "Tools" })).getByRole("button", { name: "Pass" }));
			stage().fire("pointerdown", { evt: pointer(100, 100) });
			const up = new MouseEvent("pointerup", { clientX: 100, clientY: 100 });
			Object.defineProperty(up, "pointerId", { value: 1 });
			window.dispatchEvent(up);
			await tick();
			expect(stage().find(`.${ARROW_DRAFT_NODE_NAME}`)).toHaveLength(1);

			await fireEvent.click(control("Play"));
			await fireEvent.click(control("Stop"));

			expect(stage().find(`.${ARROW_DRAFT_NODE_NAME}`)).toHaveLength(0);
		});

		it("ends the edit session of a frame description being typed", async () => {
			await showBoard();
			const field = within(screen.getByRole("complementary", { name: "Details" })).getByRole("textbox", {
				name: "Frame 2 description",
			});
			field.focus();
			await fireEvent.input(field, { target: { value: "Press" } });

			await fireEvent.click(control("Play"));
			await fireEvent.click(control("Stop"));
			situationEditor.changeFrameDescription("Press high");
			situationEditor.undo();

			expect(situationEditor.currentFrame().description).toBe("Press");
		});
	});

	describe("while playing", () => {
		async function startPlayback() {
			await showBoard();
			await fireEvent.click(control("Play"));
		}

		it("the board is read-only: taps don't place or select, nothing can be dragged", async () => {
			await startPlayback();

			stage().setPointersPositions({ clientX: 400, clientY: 300 } as unknown as PointerEvent);
			stage().fire("pointerclick", { evt: pointer(400, 300) });
			stage().findOne(`#${playerId}`)!.fire("pointerclick", { evt: pointer(250, 125) }, true);
			await tick();

			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			expect(stage().findOne(`#${playerId}`)!.draggable()).toBe(false);
			expect(situationEditor.current().frames.map((frame) => frame.elements.length)).toEqual([1, 2, 3]);
		});

		it("the tool panel is disabled", async () => {
			await startPlayback();

			for (const button of within(screen.getByRole("complementary", { name: "Tools" })).getAllByRole("button")) {
				expect(button).toBeDisabled();
			}
		});

		it("undo/redo are disabled, also by keyboard; Delete and Backspace do nothing", async () => {
			await startPlayback();
			expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
			await fireEvent.keyDown(document.body, { key: "Delete" });
			await fireEvent.keyDown(document.body, { key: "Backspace" });

			expect(situationEditor.current().frames.map((frame) => frame.elements.length)).toEqual([1, 2, 3]);
			await fireEvent.click(control("Stop"));
			expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
		});

		it("frames can't be added, deleted or moved", async () => {
			await startPlayback();

			for (const name of ["Move frame left", "Move frame right", "Add frame", "Delete frame"]) {
				expect(within(strip()).getByRole("button", { name })).toBeDisabled();
			}
		});

		it("the details can't be edited and no frame description is shown", async () => {
			await startPlayback();
			const details = screen.getByRole("complementary", { name: "Details" });

			expect(within(details).getByRole("textbox", { name: "Title" })).toBeDisabled();
			expect(within(details).getByRole("textbox", { name: "Description" })).toBeDisabled();
			expect(within(details).queryByRole("textbox", { name: /Frame \d description/ })).not.toBeInTheDocument();

			await fireEvent.click(control("Stop"));
			expect(within(details).getByRole("textbox", { name: "Frame 2 description" })).toBeEnabled();
		});

		it("a tap on a frame in the strip shows it in the slideshow, without changing the active frame", async () => {
			await startPlayback();

			await fireEvent.click(frameButton(3));

			expect(currentFrameNumber()).toBe("Frame 3");
			expect(shownElementCount()).toBe(3);
			expect(get(situationEditor.activeFrame).id).toBe(frameIds[1]);
		});

		it("Pause keeps the frame; Play resumes", async () => {
			await startPlayback();
			await advance(500);

			await fireEvent.click(control("Pause"));
			await advance(10000);
			expect(currentFrameNumber()).toBe("Frame 1");
			expect(control("Stop")).toBeEnabled();

			await fireEvent.click(control("Play"));
			await advance(1500);
			expect(currentFrameNumber()).toBe("Frame 2");
		});

		it("Previous and Next switch frames", async () => {
			await startPlayback();

			await fireEvent.click(control("Next frame"));
			expect(currentFrameNumber()).toBe("Frame 2");
			await fireEvent.click(control("Next frame"));
			expect(currentFrameNumber()).toBe("Frame 3");
			expect(control("Next frame")).toBeDisabled();
			await fireEvent.click(control("Previous frame"));
			expect(currentFrameNumber()).toBe("Frame 2");
		});

		it("Stop shows the previously active frame again", async () => {
			await startPlayback();
			await advance(4000);

			await fireEvent.click(control("Stop"));

			expect(currentFrameNumber()).toBe("Frame 2");
			expect(status()).toBe("Frame 2 / 3");
			expect(shownElementCount()).toBe(2);
		});
	});

	describe("keyboard", () => {
		it("Space starts and pauses, arrow keys switch frames, Escape stops", async () => {
			await showBoard();

			await fireEvent.keyDown(document.body, { key: " " });
			expect(currentFrameNumber()).toBe("Frame 1");
			expect(control("Pause")).toBeInTheDocument();

			await fireEvent.keyDown(document.body, { key: "ArrowRight" });
			expect(currentFrameNumber()).toBe("Frame 2");
			await fireEvent.keyDown(document.body, { key: "ArrowRight" });
			await fireEvent.keyDown(document.body, { key: "ArrowLeft" });
			expect(currentFrameNumber()).toBe("Frame 2");

			await fireEvent.keyDown(document.body, { key: " " });
			expect(control("Play")).toBeInTheDocument();
			expect(control("Stop")).toBeEnabled();

			await fireEvent.keyDown(document.body, { key: "Escape" });
			expect(control("Stop")).toBeDisabled();
			expect(currentFrameNumber()).toBe("Frame 2");
		});

		it("arrow keys don't switch frames outside playback", async () => {
			await showBoard();

			await fireEvent.keyDown(document.body, { key: "ArrowLeft" });

			expect(get(situationEditor.activeFrame).id).toBe(frameIds[1]);
			expect(control("Stop")).toBeDisabled();
		});

		it("Escape outside playback still clears the selection", async () => {
			await showBoard();
			situationEditor.selectFrame(frameIds[0]);
			await tick();
			stage().findOne(`#${playerId}`)!.fire("pointerclick", { evt: pointer(250, 125) }, true);
			await tick();

			await fireEvent.keyDown(document.body, { key: "Escape" });

			expect(screen.queryByRole("dialog", { name: "Edit marker" })).not.toBeInTheDocument();
		});

		it("Space in a text field types instead of playing", async () => {
			await showBoard();

			await fireEvent.keyDown(within(screen.getByRole("complementary", { name: "Details" })).getByRole("textbox", { name: "Title" }), {
				key: " ",
			});

			expect(control("Play")).toBeInTheDocument();
			expect(control("Stop")).toBeDisabled();
		});

		it("shortcuts don't reach playback while a modal dialog has focus", async () => {
			await showBoard();
			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			await fireEvent.keyDown(screen.getByRole("alertdialog", { name: "Discard changes?" }), { key: " " });

			expect(control("Stop")).toBeDisabled();
		});
	});

	describe("the situation is replaced", () => {
		it("importing a file stops playback", async () => {
			const imported = new SituationSerializer().serialize(situationEditor.current().withTitle("Imported"));
			situationEditor.markSaved();
			await showBoard();
			await fireEvent.click(control("Play"));

			const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
			const file = new File([imported], "imported.situation.json", { type: "application/json" });
			Object.defineProperty(input, "files", { value: [file], configurable: true });
			await fireEvent.change(input);
			await settle();
			await settle();

			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Imported");
			expect(control("Stop")).toBeDisabled();
			expect(control("Play")).toBeEnabled();
			expect(currentFrameNumber()).toBe("Frame 1");
		});

		it("a new situation stops playback", async () => {
			await showBoard();
			await fireEvent.click(control("Play"));

			situationEditor.createNew({ title: "Other", fieldType: "half" });
			await tick();

			expect(control("Stop")).toBeDisabled();
			expect(control("Play")).toBeDisabled();
			expect(status()).toBe("Frame 1 / 1");
		});

		it("exporting during playback doesn't stop it", async () => {
			const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
			await showBoard();
			await fireEvent.click(control("Play"));

			await fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

			expect(control("Stop")).toBeEnabled();
			click.mockRestore();
		});
	});

	it("leaving the page stops the timer", async () => {
		await showBoard();
		await fireEvent.click(control("Play"));
		const running = vi.getTimerCount(); // the slideshow's timer (and maybe a notification's)

		cleanup();

		expect(vi.getTimerCount()).toBe(running - 1);
	});
});
