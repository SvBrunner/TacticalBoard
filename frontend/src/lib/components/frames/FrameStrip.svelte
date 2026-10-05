<!--
@component
The frame strip: the situation's frames in order, numbered, each with a
thumbnail preview; the active frame is marked with `aria-current="step"`.
Tap/click a frame to switch to it; add a frame (a copy of the active one),
delete the active frame (the owner asks for confirmation), and reorder.

Reordering:
- Drag and drop with mouse, pen or touch (Pointer Events, see
  `FrameReorderGesture`). Mouse/pen: press and move. Touch: press and hold
  briefly, then move; a quick swipe scrolls the strip instead.
- Keyboard (and anyone who prefers buttons): "Move frame left" / "Move
  frame right" move the active frame by one position.

During playback (`playing`) the strip marks the frame being shown
(pass it as `activeFrameId`); a tap on a frame still reports `onSelect`
(the owner shows that frame of the slideshow), but frames can't be added,
deleted or reordered. The same holds with `readonly` (a situation the user
may only view, e.g. as a team Reader), where a tap switches the active frame.

Horizontally scrollable when the frames don't fit (phones); while dragging
near an edge the strip scrolls by itself.
-->
<script lang="ts">
	import { onDestroy } from "svelte";
	import { t } from "$lib/i18n";
	import type { BoardViewport } from "$lib/board/BoardViewport";
	import type { Point } from "$lib/model/Point";
	import type { Frame } from "$lib/model/Frame";
	import FrameThumbnail from "./FrameThumbnail.svelte";
	import { FrameReorderGesture, type PointerKind, type Slot } from "./FrameReorderGesture";

	interface Props {
		frames: readonly Frame[];
		activeFrameId: string;
		viewport: BoardViewport;
		onSelect: (frameId: string) => void;
		/** Add a copy of the active frame after it. */
		onAdd: () => void;
		/** Delete the frame (the owner asks for confirmation first). */
		onDelete: (frameId: string) => void;
		/** Move the frame so that it ends up at `toIndex`. */
		onMove: (frameId: string, toIndex: number) => void;
		/** Height of the thumbnails in CSS px. */
		thumbnailHeight?: number;
		/** Slideshow playback is running: frames can't be added, deleted or reordered. */
		playing?: boolean;
		/** The situation may only be viewed: frames can't be added, deleted or reordered. */
		readonly?: boolean;
	}

	let {
		frames,
		activeFrameId,
		viewport,
		onSelect,
		onAdd,
		onDelete,
		onMove,
		thumbnailHeight = 40,
		playing = false,
		readonly = false,
	}: Props = $props();

	/** Frames can't be added, deleted or reordered. */
	const locked = $derived(playing || readonly);

	const activeIndex = $derived(frames.findIndex((frame) => frame.id === activeFrameId));

	let list: HTMLOListElement | undefined = $state();

	/** What the template needs to know about a running drag. */
	interface DragView {
		readonly from: number;
		readonly offset: number;
		readonly shifts: readonly number[];
	}

	let drag = $state<DragView | null>(null);
	let gesture: FrameReorderGesture | null = null;
	let pointerId: number | null = null;
	let pressedItem: HTMLElement | null = null;
	let lastClient: Point = { x: 0, y: 0 };
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let scrollFrame: number | undefined;
	/** Set when a drag ended, so the click the browser may send afterwards doesn't select the frame. */
	let suppressClick = false;

	function pointerKindOf(event: PointerEvent): PointerKind {
		return event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse";
	}

	/** Pointer position in the list's scrollable content coordinates (independent of the scroll position). */
	function contentPoint(client: Point): Point {
		const rect = list!.getBoundingClientRect();
		return { x: client.x - rect.left + list!.scrollLeft, y: client.y - rect.top };
	}

	function measureSlots(): Slot[] {
		return Array.from(list!.children, (item) => {
			const element = item as HTMLElement;
			return { start: element.offsetLeft, end: element.offsetLeft + element.offsetWidth };
		});
	}

	function refresh() {
		const current = gesture;
		drag = current?.isDragging
			? { from: current.fromIndex, offset: current.offset, shifts: frames.map((_, index) => current.shiftFor(index)) }
			: null;
	}

	function handlePointerDown(event: PointerEvent, index: number) {
		// Primary button only; a second finger while one gesture runs is ignored; no reordering during playback.
		if (locked || event.button !== 0 || gesture || !list) {
			return;
		}
		suppressClick = false;
		pointerId = event.pointerId;
		pressedItem = event.currentTarget as HTMLElement;
		lastClient = { x: event.clientX, y: event.clientY };
		const kind = pointerKindOf(event);
		gesture = new FrameReorderGesture(index, measureSlots(), contentPoint(lastClient), kind);
		if (kind === "touch") {
			holdTimer = setTimeout(() => {
				gesture?.holdElapsed();
				if (gesture?.isDragging) {
					dragStarted();
				}
			}, FrameReorderGesture.LONG_PRESS_MS);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!gesture || event.pointerId !== pointerId) {
			return;
		}
		lastClient = { x: event.clientX, y: event.clientY };
		const wasDragging = gesture.isDragging;
		gesture.move(contentPoint(lastClient));
		if (!gesture.isActive) {
			endGesture(); // a touch that moved before the long press: the browser scrolls
			return;
		}
		if (!wasDragging && gesture.isDragging) {
			dragStarted();
		} else {
			refresh();
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (!gesture || event.pointerId !== pointerId) {
			return;
		}
		const reorder = gesture.release();
		if (gesture.didDrag) {
			// The click (if any) follows in the same task; a later click is a real one again.
			suppressClick = true;
			setTimeout(() => (suppressClick = false), 0);
		}
		const frameId = reorder ? frames[reorder.from]?.id : undefined;
		endGesture();
		if (reorder && frameId !== undefined) {
			onMove(frameId, reorder.to);
		}
	}

	function handlePointerCancel(event: PointerEvent) {
		if (gesture && event.pointerId === pointerId) {
			gesture.cancel();
			endGesture();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && gesture?.isDragging) {
			event.preventDefault();
			gesture.cancel();
			endGesture();
		}
	}

	function handleClickCapture(event: MouseEvent) {
		if (suppressClick) {
			suppressClick = false;
			event.preventDefault();
			event.stopPropagation();
		}
	}

	function handleContextMenu(event: MouseEvent) {
		// A long press on touch would open the context menu (or a callout) instead of dragging.
		if (gesture) {
			event.preventDefault();
		}
	}

	function dragStarted() {
		clearTimeout(holdTimer);
		if (pressedItem && pointerId !== null && typeof pressedItem.setPointerCapture === "function") {
			try {
				pressedItem.setPointerCapture(pointerId);
			} catch {
				// The pointer is already gone; pointerup/cancel will end the gesture.
			}
		}
		refresh();
		scheduleAutoScroll();
	}

	function scheduleAutoScroll() {
		if (scrollFrame === undefined && typeof requestAnimationFrame === "function") {
			scrollFrame = requestAnimationFrame(autoScroll);
		}
	}

	function autoScroll() {
		scrollFrame = undefined;
		if (!gesture?.isDragging || !list) {
			return;
		}
		const rect = list.getBoundingClientRect();
		const step = FrameReorderGesture.autoScrollStep(lastClient.x, rect.left, rect.right);
		if (step !== 0) {
			const before = list.scrollLeft;
			list.scrollLeft = before + step;
			if (list.scrollLeft !== before) {
				gesture.move(contentPoint(lastClient));
				refresh();
			}
		}
		scheduleAutoScroll();
	}

	function endGesture() {
		clearTimeout(holdTimer);
		holdTimer = undefined;
		if (scrollFrame !== undefined && typeof cancelAnimationFrame === "function") {
			cancelAnimationFrame(scrollFrame);
		}
		scrollFrame = undefined;
		if (pressedItem && pointerId !== null && pressedItem.hasPointerCapture?.(pointerId)) {
			pressedItem.releasePointerCapture(pointerId);
		}
		gesture = null;
		pointerId = null;
		pressedItem = null;
		drag = null;
	}

	function transformFor(index: number, view: DragView | null): string | undefined {
		if (!view) {
			return undefined;
		}
		const dx = index === view.from ? view.offset : view.shifts[index];
		return dx ? `translateX(${dx}px)` : undefined;
	}

	function moveActive(delta: -1 | 1) {
		const to = activeIndex + delta;
		if (!locked && activeIndex !== -1 && to >= 0 && to < frames.length) {
			onMove(activeFrameId, to);
		}
	}

	function addFrame() {
		if (!locked) {
			onAdd();
		}
	}

	function deleteActive() {
		if (!locked && frames.length > 1) {
			onDelete(activeFrameId);
		}
	}

	// While dragging by touch, keep the browser from scrolling the strip (needs a non-passive listener).
	$effect(() => {
		const element = list;
		if (!element) {
			return;
		}
		const preventScroll = (event: TouchEvent) => {
			if (gesture?.isDragging && event.cancelable) {
				event.preventDefault();
			}
		};
		element.addEventListener("touchmove", preventScroll, { passive: false });
		return () => element.removeEventListener("touchmove", preventScroll);
	});

	// Keep the active frame visible (after switching, adding, or reordering).
	$effect(() => {
		void activeFrameId;
		void frames.length;
		const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
		if (current && typeof current.scrollIntoView === "function") {
			current.scrollIntoView({ block: "nearest", inline: "nearest" });
		}
	});

	onDestroy(() => endGesture());
</script>

<svelte:window
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
	onkeydown={handleKeydown}
/>

<nav class="frame-strip" aria-label={$t.frames.strip}>
	<ol bind:this={list} class="frames" class:dragging={drag !== null} onclickcapture={handleClickCapture}>
		{#each frames as frame, index (frame.id)}
			<li
				class="frame"
				class:dragged={drag?.from === index}
				style:transform={transformFor(index, drag)}
				onpointerdown={(event) => handlePointerDown(event, index)}
				onlostpointercapture={handlePointerCancel}
				oncontextmenu={handleContextMenu}
			>
				<button
					type="button"
					class="frame-btn"
					aria-current={frame.id === activeFrameId ? "step" : undefined}
					onclick={() => onSelect(frame.id)}
				>
					<FrameThumbnail {frame} {viewport} height={thumbnailHeight} />
					<span class="number" aria-hidden="true">{index + 1}</span>
					<span class="visually-hidden">{$t.frames.frame(index + 1)}</span>
				</button>
			</li>
		{/each}
	</ol>

	<div class="frame-actions" role="group" aria-label={$t.frames.actions}>
		<button
			type="button"
			class="action-btn"
			aria-label={$t.frames.moveLeft}
			title={$t.frames.moveLeft}
			disabled={locked || activeIndex <= 0}
			onclick={() => moveActive(-1)}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6" /></svg>
		</button>
		<button
			type="button"
			class="action-btn"
			aria-label={$t.frames.moveRight}
			title={$t.frames.moveRight}
			disabled={locked || activeIndex === -1 || activeIndex >= frames.length - 1}
			onclick={() => moveActive(1)}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" /></svg>
		</button>
		<button type="button" class="action-btn primary" title={$t.frames.addTitle} disabled={locked} onclick={addFrame}>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
			<span class="label">{$t.frames.add}</span>
		</button>
		<button type="button" class="action-btn" title={$t.frames.deleteTitle} disabled={locked || frames.length <= 1} onclick={deleteActive}>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
			<span class="label">{$t.frames.delete}</span>
		</button>
	</div>
</nav>

<style>
	.frame-strip {
		container-type: inline-size;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding: 8px 16px;
		padding-left: calc(16px + env(safe-area-inset-left, 0px));
		padding-right: calc(16px + env(safe-area-inset-right, 0px));
		background: var(--bg-surface);
		box-shadow: 0 -1px 0 var(--border);
	}

	.frames {
		position: relative; /* offsetLeft of the items is measured against the list */
		flex: 1;
		min-width: 0;
		display: flex;
		gap: 8px;
		margin: 0;
		padding: 4px;
		list-style: none;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		/* The browser may scroll the strip horizontally; everything else is a frame gesture. */
		touch-action: pan-x;
		scrollbar-width: thin;
	}

	.frame {
		flex-shrink: 0;
		transition: transform 150ms ease;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.frames.dragging {
		cursor: grabbing;
	}

	.frame.dragged {
		position: relative;
		z-index: 1;
		transition: none;
	}

	.frame.dragged .frame-btn {
		box-shadow: var(--shadow);
		cursor: grabbing;
	}

	.frame-btn {
		position: relative;
		display: block;
		min-width: var(--touch-target);
		min-height: var(--touch-target);
		padding: 3px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.frame-btn[aria-current="step"] {
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.frame-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* A small badge on the button's corner, so it covers as little of the thumbnail as possible. */
	.number {
		position: absolute;
		top: -4px;
		left: -4px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 9px;
		box-shadow: 0 0 0 2px var(--bg-surface);
		background: var(--text);
		color: var(--bg-surface);
		font-size: 11px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
		pointer-events: none;
	}

	.frame-btn[aria-current="step"] .number {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.frame-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: var(--touch-target);
		height: var(--touch-target);
		padding: 0 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.action-btn[aria-label] {
		padding: 0;
	}

	.action-btn.primary {
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 600;
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* A narrow strip keeps its room for the frames: icon-only actions (the text stays the accessible name). */
	@container (max-width: 720px) {
		.action-btn {
			padding: 0;
		}

		.label {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
			border: 0;
		}
	}

	@media (max-width: 1023px) {
		.frame-strip {
			padding-top: 6px;
			padding-bottom: 6px;
			gap: 8px;
		}
	}

	/* Phones: compact. */
	@media (max-width: 599px), (max-height: 499px) {
		.frame-strip {
			padding: 4px 8px;
			padding-left: calc(8px + env(safe-area-inset-left, 0px));
			padding-right: calc(8px + env(safe-area-inset-right, 0px));
			gap: 4px;
		}

		.frame-actions {
			gap: 4px;
		}

		/* Smaller thumbnails; the width follows the field's aspect ratio. */
		.frame-btn :global(.frame-thumbnail) {
			width: auto;
			height: 36px;
		}

	}
</style>
