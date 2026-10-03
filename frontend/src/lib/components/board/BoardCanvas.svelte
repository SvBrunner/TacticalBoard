<!--
@component
The board: field background plus the active frame's elements on a Konva
stage that is scaled to fit the available space. The viewport decides what
is visible: the whole field (landscape, unrotated) or the half field
(portrait, stage rotated by 90°, the rest of the field cropped). Translates
raw Konva pointer/drag events into board gestures (in scene units) for the
controller.

Elements are drawn in one layer, in three groups from bottom to top:
arrows (always below), point elements, and the overlay (the preview of an
arrow being drawn and the handles of the selected arrow).

While an arrow tool is active (`arrowTool`), elements are not draggable and
presses are fed to the controller's arrow gestures (`pointerDown` from
Konva, which knows the pressed element; moves and releases from the
window, so a drag that leaves the stage still ends).

Whenever the stage geometry changes (container resize, device rotation,
window resize, another viewport), it asks the controller to re-anchor an
open popover at the selected element's new on-screen position.
-->
<script lang="ts">
	import { untrack } from "svelte";
	import { Stage, Layer, Rect, Group } from "svelte-konva";
	import type { Point } from "$lib/model/Point";
	import type { KonvaEventObject, Node } from "konva/lib/Node";
	import { observeSize, type Size } from "$lib/actions/observeSize";
	import type { ArrowDraft, ArrowGestures, GesturePoint } from "$lib/board/ArrowGestures";
	import { ArrowHandle } from "$lib/board/ArrowHandle";
	import type { BoardInteractionController } from "$lib/board/BoardInteractionController";
	import { BoardViewport, type ScreenRect } from "$lib/board/BoardViewport";
	import { ArrowElement } from "$lib/model/elements/ArrowElement";
	import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
	import type { BoardElement } from "$lib/model/elements/BoardElement";
	import type { ArrowElementType } from "$lib/model/elements/ElementType";
	import { PointElement } from "$lib/model/elements/PointElement";
	import ArrowDraftPreview from "./ArrowDraftPreview.svelte";
	import ArrowHandleShape from "./ArrowHandleShape.svelte";
	import ArrowShape from "./ArrowShape.svelte";
	import BoardComponent from "./BoardComponent.svelte";
	import { elementCatalog } from "./ElementCatalog";
	import FloorballFullField from "./background/FloorballFullField.svelte";
	import { ARROW_HANDLE_NODE_NAME, ARROW_NODE_NAME, ELEMENT_NODE_NAME, visualRadius } from "./Shapes";

	/** The gestures the canvas reports. */
	type BoardGestures = Pick<
		BoardInteractionController,
		| "tapElement"
		| "tapField"
		| "contextMenu"
		| "dragStart"
		| "dragMove"
		| "dragEnd"
		| "relocatePopover"
		| "pointerDown"
		| "pointerMove"
		| "pointerUp"
		| "pointerCancel"
		| "arrowDragStart"
		| "arrowDragMove"
		| "arrowDragEnd"
		| "handleDragStart"
		| "handleDragMove"
		| "handleDragEnd"
		| "tapHandle"
		| "doubleTapHandle"
	> & { readonly arrowDraft: ArrowGestures["draft"] };

	interface Props {
		elements: readonly BoardElement[];
		selectedId: string | null;
		/** The active bend of the selected arrow, if any. */
		selectedBend?: number | null;
		controller: BoardGestures;
		viewport: BoardViewport;
		/** The active arrow tool, or `null` when no arrow tool is active. */
		arrowTool?: ArrowElementType | null;
	}

	let { elements, selectedId, selectedBend = null, controller, viewport, arrowTool = null }: Props = $props();

	let size = $state<Size>({ width: 0, height: 0 });
	const fit = $derived(viewport.fit(size.width, size.height));

	let stageContainer: HTMLDivElement | undefined = $state();
	/** Bumped on window resizes, which can move the stage without resizing it. */
	let windowGeometry = $state(0);

	let arrowDraft = $state<ArrowDraft | null>(null);
	$effect(() => controller.arrowDraft.subscribe((draft) => (arrowDraft = draft)));
	const drawing = $derived(arrowTool !== null);

	/** The handle being dragged and the arrow's shape with it (the model only changes on drop). */
	let handleDrag = $state<{ id: string; handle: ArrowHandle; preview: ArrowGeometry } | null>(null);
	/** The arrow being dragged as a whole (its handles are hidden meanwhile). */
	let draggedArrowId = $state<string | null>(null);

	const selectedArrow = $derived.by(() => {
		const element = elements.find((candidate) => candidate.id === selectedId);
		return element instanceof ArrowElement ? element : null;
	});
	const handles = $derived.by(() => {
		if (!selectedArrow || draggedArrowId === selectedArrow.id) {
			return [];
		}
		const all = ArrowHandle.allOf(selectedArrow.geometry);
		const dragged = handleDrag?.id === selectedArrow.id ? handleDrag.handle.key : null;
		return dragged === null ? all : all.filter((handle) => handle.key === dragged);
	});
	/** Width of an arrow's hit region: at least 44 CSS px. */
	const arrowHitWidth = $derived(fit.scale > 0 ? (2 * BoardViewport.MIN_TOUCH_RADIUS_PX) / fit.scale : 0);

	function elementIdOf(target: Node): string | null {
		const name = target.name();
		return name === ELEMENT_NODE_NAME || name === ARROW_NODE_NAME ? target.id() : null;
	}

	function handleOf(target: Node): { arrow: ArrowElement; handle: ArrowHandle } | null {
		if (target.name() !== ARROW_HANDLE_NODE_NAME) {
			return null;
		}
		const arrow = elements.find((element) => element.id === target.getAttr("arrowId"));
		if (!(arrow instanceof ArrowElement)) {
			return null;
		}
		const handle = ArrowHandle.find(arrow.geometry, target.getAttr("handleKey"));
		return handle ? { arrow, handle } : null;
	}

	function containerOrigin(): Point {
		const container = stageContainer?.getBoundingClientRect();
		return { x: container?.left ?? 0, y: container?.top ?? 0 };
	}

	function anchorOfElement(id: string, current = fit): ScreenRect | null {
		const element = elements.find((candidate) => candidate.id === id);
		if (element instanceof PointElement) {
			return viewport.screenRect(element, visualRadius(element.type), current, containerOrigin());
		}
		if (element instanceof ArrowElement) {
			return viewport.screenRectOfBounds(element.geometry.bounds(), current, containerOrigin());
		}
		return null;
	}

	function gesturePoint(evt: PointerEvent): GesturePoint {
		const origin = containerOrigin();
		const screen = { x: evt.clientX - origin.x, y: evt.clientY - origin.y };
		return { pointerId: evt.pointerId, scene: viewport.stageToScene(screen, fit), screen, scale: fit.scale };
	}

	// Re-anchor an open popover whenever the stage geometry changes.
	$effect(() => {
		const current = fit;
		void windowGeometry;
		if (!(current.width > 0) || !stageContainer) {
			return;
		}
		untrack(() => controller.relocatePopover((id) => anchorOfElement(id, current)));
	});

	// `pointerclick` covers mouse, touch and pen, and doesn't fire after a drag.
	function handlePointerClick(e: KonvaEventObject<PointerEvent>) {
		if (e.evt.button > 0) {
			return; // secondary buttons are handled as contextmenu
		}
		const handle = handleOf(e.target);
		if (handle) {
			const anchor = anchorOfElement(handle.arrow.id);
			if (anchor) {
				controller.tapHandle(handle.arrow.id, handle.arrow.geometry, handle.handle, anchor);
			}
			return;
		}
		const id = elementIdOf(e.target);
		if (id) {
			const anchor = anchorOfElement(id);
			if (anchor) {
				controller.tapElement(id, anchor, { shiftKey: e.evt.shiftKey });
			}
			return;
		}
		const position = e.target.getStage()?.getPointerPosition();
		if (position) {
			controller.tapField(viewport.stageToScene(position, fit));
		}
	}

	function handlePointerDblClick(e: KonvaEventObject<PointerEvent>) {
		const handle = handleOf(e.target);
		if (handle) {
			controller.doubleTapHandle(handle.arrow.id, handle.handle);
		}
	}

	function handleContextMenu(e: KonvaEventObject<MouseEvent>) {
		e.evt.preventDefault();
		const id = elementIdOf(e.target);
		const anchor = id === null ? null : anchorOfElement(id);
		if (id !== null && anchor) {
			controller.contextMenu(id, anchor);
		}
	}

	// Drawing arrows: the press comes from Konva (it knows the pressed element) ...
	function handlePointerDown(e: KonvaEventObject<PointerEvent>) {
		if (!drawing || e.evt.button > 0 || e.target.name() === ARROW_HANDLE_NODE_NAME) {
			return;
		}
		controller.pointerDown(gesturePoint(e.evt), elementIdOf(e.target));
	}

	// ... moves and releases from the window, so they arrive also outside the stage.
	function handleWindowPointerMove(evt: PointerEvent) {
		if (drawing && stageContainer) {
			controller.pointerMove(gesturePoint(evt));
		}
	}

	function handleWindowPointerUp(evt: PointerEvent) {
		if (drawing && stageContainer) {
			controller.pointerUp(gesturePoint(evt), { shiftKey: evt.shiftKey }, (id) => anchorOfElement(id));
		}
	}

	function handleWindowPointerCancel() {
		if (drawing) {
			controller.pointerCancel();
		}
	}

	function arrowGeometryOf(arrow: ArrowElement): ArrowGeometry {
		return handleDrag?.id === arrow.id ? handleDrag.preview : arrow.geometry;
	}

	function startArrowDrag(id: string) {
		draggedArrowId = id;
		controller.arrowDragStart(id);
	}

	function moveArrow(arrow: ArrowElement, delta: Point): Point {
		return controller.arrowDragMove(arrow.geometry, delta);
	}

	function endArrowDrag(arrow: ArrowElement, delta: Point) {
		draggedArrowId = null;
		controller.arrowDragEnd(arrow.id, arrow.geometry, delta);
	}

	function startHandleDrag(arrow: ArrowElement, handle: ArrowHandle) {
		handleDrag = { id: arrow.id, handle, preview: arrow.geometry };
		controller.handleDragStart(arrow.id);
	}

	function moveHandle(arrow: ArrowElement, handle: ArrowHandle, point: Point): Point {
		const preview = controller.handleDragMove(arrow.geometry, handle, point);
		handleDrag = { id: arrow.id, handle, preview };
		return handle.afterDrag().positionOn(preview);
	}

	function endHandleDrag(arrow: ArrowElement, handle: ArrowHandle, point: Point) {
		handleDrag = null;
		controller.handleDragEnd(arrow.id, arrow.geometry, handle, point);
	}
</script>

<svelte:window
	onresize={() => windowGeometry++}
	onpointermove={handleWindowPointerMove}
	onpointerup={handleWindowPointerUp}
	onpointercancel={handleWindowPointerCancel}
/>

<section class="field-area" aria-label="Field" use:observeSize={(next) => (size = next)}>
	{#if fit.width > 0}
		<div bind:this={stageContainer} class="stage-container" style:width="{fit.width}px" style:height="{fit.height}px">
			<Stage
				width={fit.width}
				height={fit.height}
				scaleX={fit.scale}
				scaleY={fit.scale}
				rotation={fit.rotation}
				x={fit.x}
				y={fit.y}
				onpointerclick={handlePointerClick}
				onpointerdblclick={handlePointerDblClick}
				onpointerdown={handlePointerDown}
				oncontextmenu={handleContextMenu}
			>
				<Layer listening={false}>
					<Rect width={viewport.field.width} height={viewport.field.height} fill="white" />
				</Layer>
				<FloorballFullField width={viewport.field.width} height={viewport.field.height} />

				<Layer>
					<Group name="arrows">
						{#each elements as element (element.id)}
							{#if element instanceof ArrowElement}
								<ArrowShape
									id={element.id}
									type={element.type}
									color={element.color}
									geometry={arrowGeometryOf(element)}
									hitWidth={arrowHitWidth}
									draggable={!drawing}
									onDragStart={startArrowDrag}
									onDragMove={(_id, delta) => moveArrow(element, delta)}
									onDragEnd={(_id, delta) => endArrowDrag(element, delta)}
								/>
							{/if}
						{/each}
					</Group>
					<Group name="points">
						{#each elements as element (element.id)}
							{#if element instanceof PointElement}
								<BoardComponent
									id={element.id}
									x={element.x}
									y={element.y}
									color={element.color}
									type={element.type}
									hitRadius={viewport.hitRadius(visualRadius(element.type), fit.scale)}
									selected={element.id === selectedId}
									draggable={!drawing}
									label={element.showsLabel ? element.label : ""}
									labelRotation={0 - fit.rotation}
									onDragStart={(id) => controller.dragStart(id)}
									onDragMove={(_id, position) => controller.dragMove(position)}
									onDragEnd={(id, position) => controller.dragEnd(id, position)}
								/>
							{/if}
						{/each}
					</Group>
					<Group name="overlay">
						{#if arrowDraft && arrowTool}
							<ArrowDraftPreview draft={arrowDraft} type={arrowTool} color={elementCatalog.arrowColor} scale={fit.scale} />
						{/if}
						{#if selectedArrow}
							{@const arrow = selectedArrow}
							<!-- Two groups: Konva appends new nodes at the end, so a group (not the order
							     of creation) keeps the "add bend" handles below the point handles. -->
							{#each [handles.filter((handle) => !handle.isPoint), handles.filter((handle) => handle.isPoint)] as group, groupIndex (groupIndex)}
								<Group name={groupIndex === 0 ? "insert-handles" : "point-handles"}>
									{#each group as handle (handle.key)}
										{@const position = handle.positionOn(arrow.geometry)}
										<ArrowHandleShape
											arrowId={arrow.id}
											{handle}
											x={position.x}
											y={position.y}
											scale={fit.scale}
											active={handle.kind === "bend" && handle.index === selectedBend}
											onDragStart={(dragged) => startHandleDrag(arrow, dragged)}
											onDragMove={(dragged, point) => moveHandle(arrow, dragged, point)}
											onDragEnd={(dragged, point) => endHandleDrag(arrow, dragged, point)}
										/>
									{/each}
								</Group>
							{/each}
						{/if}
					</Group>
				</Layer>
			</Stage>
		</div>
	{/if}
</section>

<style>
	.field-area {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 40px;
	}

	/* The board handles every touch itself: no scrolling, zooming, text selection or callout. */
	.stage-container {
		flex-shrink: 0;
		background: var(--field-surface);
		border-radius: var(--radius-lg);
		box-shadow:
			0 0 0 1px var(--border),
			var(--shadow);
		overflow: hidden;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}

	@media (max-width: 1023px) {
		.field-area {
			padding: 16px;
		}

		.stage-container {
			border-radius: var(--radius-md);
		}
	}

	@media (max-width: 599px), (max-height: 499px) {
		.field-area {
			padding: 8px;
		}

		.stage-container {
			border-radius: var(--radius-sm);
		}
	}
</style>
