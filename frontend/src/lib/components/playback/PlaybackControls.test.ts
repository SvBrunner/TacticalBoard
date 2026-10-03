import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import PlaybackControls from "./PlaybackControls.svelte";
import type { PlaybackStatus } from "$lib/playback/SlideshowPlayer";

function renderControls(overrides: Record<string, unknown> = {}) {
	const handlers = {
		onTogglePlay: vi.fn<() => void>(),
		onPrevious: vi.fn<() => void>(),
		onNext: vi.fn<() => void>(),
		onStop: vi.fn<() => void>(),
		onFrameDurationChange: vi.fn<(ms: number) => void>(),
		onLoopChange: vi.fn<(loop: boolean) => void>(),
	};
	const result = render(PlaybackControls, {
		props: {
			status: "stopped" as PlaybackStatus,
			frameNumber: 1,
			frameCount: 3,
			canPlay: true,
			frameDurationMs: 2000,
			loop: false,
			...handlers,
			...overrides,
		},
	});
	const region = screen.getByRole("region", { name: "Playback" });
	const button = (name: string) => within(region).getByRole("button", { name });
	return { ...result, ...handlers, region, button };
}

describe("PlaybackControls", () => {
	describe("semantics", () => {
		it("is a region named Playback with a group of transport buttons", () => {
			const { region } = renderControls();

			expect(region.tagName).toBe("SECTION");
			const group = within(region).getByRole("group", { name: "Playback controls" });
			expect(within(group).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
				"Play",
				"Previous frame",
				"Next frame",
				"Stop",
			]);
		});

		it("gives every control an accessible name, also when shown icon-only", () => {
			const { region } = renderControls();

			for (const control of within(region).getAllByRole("button")) {
				expect(control).toHaveAccessibleName();
				expect(control).toHaveAttribute("type", "button");
			}
			expect(within(region).getByRole("combobox", { name: "Frame duration" })).toBeInTheDocument();
			expect(within(region).getByRole("button", { name: "Loop" })).toBeInTheDocument();
		});

		it("mentions the keyboard shortcuts in the tooltips", () => {
			const { button } = renderControls({ status: "playing", frameNumber: 2 });

			expect(button("Pause")).toHaveAttribute("title", "Pause (Space)");
			expect(button("Previous frame")).toHaveAttribute("title", "Previous frame (←)");
			expect(button("Next frame")).toHaveAttribute("title", "Next frame (→)");
			expect(button("Stop")).toHaveAttribute("title", "Stop (Esc)");
		});

		it("shows the frame on the board as 'Frame n / N'", () => {
			const { region } = renderControls({ frameNumber: 2, frameCount: 5 });

			expect(within(region).getByText("Frame").closest("p")).toHaveTextContent("Frame 2 / 5");
		});
	});

	describe("stopped", () => {
		it("only Play is enabled", () => {
			const { button } = renderControls();

			expect(button("Play")).toBeEnabled();
			expect(button("Previous frame")).toBeDisabled();
			expect(button("Next frame")).toBeDisabled();
			expect(button("Stop")).toBeDisabled();
		});

		it("Play is disabled with only one frame and explains why", () => {
			const { button, onTogglePlay } = renderControls({ canPlay: false, frameCount: 1 });

			expect(button("Play")).toBeDisabled();
			expect(button("Play")).toHaveAttribute("title", "Play (needs at least two frames)");
			button("Play").click();
			expect(onTogglePlay).not.toHaveBeenCalled();
		});

		it("Play reports the toggle", async () => {
			const { button, onTogglePlay } = renderControls();

			await fireEvent.click(button("Play"));

			expect(onTogglePlay).toHaveBeenCalledOnce();
		});

		it("disabled buttons don't report synthetic clicks", () => {
			const { button, onPrevious, onNext, onStop } = renderControls();

			button("Previous frame").click();
			button("Next frame").click();
			button("Stop").click();

			expect(onPrevious).not.toHaveBeenCalled();
			expect(onNext).not.toHaveBeenCalled();
			expect(onStop).not.toHaveBeenCalled();
		});
	});

	describe("during playback", () => {
		it("the play button becomes Pause while playing and Play again while paused", async () => {
			const { button, rerender } = renderControls({ status: "playing" });
			expect(button("Pause")).toBeEnabled();

			await rerender({ status: "paused" });

			expect(button("Play")).toBeEnabled();
		});

		it("Play stays enabled while paused even if the frames are fewer than two", () => {
			const { button } = renderControls({ status: "paused", canPlay: false });

			expect(button("Play")).toBeEnabled();
		});

		it("Previous, Next and Stop report their actions", async () => {
			const { button, onPrevious, onNext, onStop } = renderControls({ status: "playing", frameNumber: 2 });

			await fireEvent.click(button("Previous frame"));
			await fireEvent.click(button("Next frame"));
			await fireEvent.click(button("Stop"));

			expect(onPrevious).toHaveBeenCalledOnce();
			expect(onNext).toHaveBeenCalledOnce();
			expect(onStop).toHaveBeenCalledOnce();
		});

		it("Previous is disabled at the first frame, Next at the last", async () => {
			const { button, rerender } = renderControls({ status: "paused", frameNumber: 1, frameCount: 3 });
			expect(button("Previous frame")).toBeDisabled();
			expect(button("Next frame")).toBeEnabled();

			await rerender({ frameNumber: 3 });

			expect(button("Previous frame")).toBeEnabled();
			expect(button("Next frame")).toBeDisabled();
		});

		it("marks the region as active", () => {
			const { region } = renderControls({ status: "playing" });

			expect(region).toHaveClass("active");
		});
	});

	describe("settings", () => {
		it("offers 1, 2, 3 and 5 seconds and shows the current duration", () => {
			renderControls({ frameDurationMs: 3000 });
			const select = screen.getByRole("combobox", { name: "Frame duration" }) as HTMLSelectElement;

			expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["1 s", "2 s", "3 s", "5 s"]);
			expect(select.value).toBe("3000");
		});

		it("reports a new duration in milliseconds", async () => {
			const { onFrameDurationChange } = renderControls();

			await fireEvent.change(screen.getByRole("combobox", { name: "Frame duration" }), { target: { value: "5000" } });

			expect(onFrameDurationChange).toHaveBeenCalledWith(5000);
		});

		it("the duration can be changed during playback", () => {
			renderControls({ status: "playing" });

			expect(screen.getByRole("combobox", { name: "Frame duration" })).toBeEnabled();
		});

		it("Loop is a toggle button reflecting the setting", async () => {
			const { button, onLoopChange, rerender } = renderControls({ loop: false });
			expect(button("Loop")).toHaveAttribute("aria-pressed", "false");

			await fireEvent.click(button("Loop"));
			expect(onLoopChange).toHaveBeenLastCalledWith(true);

			await rerender({ loop: true });
			expect(button("Loop")).toHaveAttribute("aria-pressed", "true");
			await fireEvent.click(button("Loop"));
			expect(onLoopChange).toHaveBeenLastCalledWith(false);
		});
	});

	describe("keyboard", () => {
		it("every control is a native, focusable form control, in a sensible order (no positive tabindex)", () => {
			const { region } = renderControls({ status: "playing", frameNumber: 2 });

			const focusable = Array.from(region.querySelectorAll<HTMLElement>("button, select"));
			expect(focusable.map((control) => control.getAttribute("aria-label") ?? control.textContent?.trim())).toEqual([
				"Pause",
				"Previous frame",
				"Next frame",
				"Stop",
				"1 s2 s3 s5 s",
				"Loop",
			]);
			for (const control of focusable) {
				expect(control.tabIndex).toBe(0);
				control.focus();
				expect(document.activeElement).toBe(control);
			}
		});

		it("keys pressed on the controls bubble up to the page, which handles the playback shortcuts", async () => {
			const { button } = renderControls({ status: "playing", frameNumber: 2 });
			const seen: string[] = [];
			const listener = (event: KeyboardEvent) => seen.push(event.key);
			window.addEventListener("keydown", listener);

			await fireEvent.keyDown(button("Stop"), { key: "Escape" });
			await fireEvent.keyDown(button("Stop"), { key: "ArrowRight" });
			window.removeEventListener("keydown", listener);

			expect(seen).toEqual(["Escape", "ArrowRight"]);
		});
	});
});
