<!--
@component
The board: field background plus the active frame's elements on a Konva
stage that is scaled to fit the available space. The viewport decides what
is visible: the whole field (landscape, unrotated) or the half field
(portrait, stage rotated by 90°, the rest of the field cropped). Translates
raw Konva pointer/drag events into board gestures (in scene units) for the
controller.
Whenever the stage geometry changes (container resize, device rotation,
window resize, another viewport), it asks the controller to re-anchor an
open popover at the selected element's new on-screen position.
-->
<script lang="ts">
	import { untrack } from "svelte";
	import { Stage, Layer, Rect } from "svelte-konva";
	import type { Point } from "$lib/commands/Point";
	import type { KonvaEventObject, Node } from "konva/lib/Node";
	import { observeSize, type Size } from "$lib/actions/observeSize";
	import type { BoardInteractionController } from "$lib/board/BoardInteractionController";
	import type { BoardViewport, ScreenRect } from "$lib/board/BoardViewport";
	import type { BoardElement } from "$lib/model/elements/BoardElement";
	import { isElementType, type ElementType } from "$lib/model/elements/ElementType";
	import { PointElement } from "$lib/model/elements/PointElement";
	import BoardComponent from "./BoardComponent.svelte";
	import FloorballFullField from "./background/FloorballFullField.svelte";
	import { ELEMENT_NODE_NAME, visualRadius } from "./Shapes";

	/** The gestures the canvas reports. */
	type BoardGestures = Pick<
		BoardInteractionController,
		"tapElement" | "tapField" | "contextMenu" | "dragStart" | "dragMove" | "dragEnd" | "relocatePopover"
	>;

	interface Props {
		elements: readonly BoardElement[];
		selectedId: string | null;
		controller: BoardGestures;
		viewport: BoardViewport;
	}

	let { elements, selectedId, controller, viewport }: Props = $props();

	let size = $state<Size>({ width: 0, height: 0 });
	const fit = $derived(viewport.fit(size.width, size.height));

	let stageContainer: HTMLDivElement | undefined = $state();
	/** Bumped on window resizes, which can move the stage without resizing it. */
	let windowGeometry = $state(0);

	function elementNode(target: Node): Node | null {
		return target.name() === ELEMENT_NODE_NAME ? target : null;
	}

	function screenAnchor(center: Point, type: ElementType | undefined, current = fit): ScreenRect {
		const container = stageContainer?.getBoundingClientRect();
		return viewport.screenRect(center, type ? visualRadius(type) : 0, current, {
			x: container?.left ?? 0,
			y: container?.top ?? 0,
		});
	}

	function anchorFor(node: Node): ScreenRect {
		const type = node.getAttr("elementType");
		return screenAnchor(node.position(), isElementType(type) ? type : undefined);
	}

	function anchorOfElement(id: string, current: typeof fit): ScreenRect | null {
		const element = elements.find((candidate) => candidate.id === id);
		return element instanceof PointElement ? screenAnchor(element, element.type, current) : null;
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
		const node = elementNode(e.target);
		if (node) {
			controller.tapElement(node.id(), anchorFor(node), { shiftKey: e.evt.shiftKey });
			return;
		}
		const position = e.target.getStage()?.getPointerPosition();
		if (position) {
			controller.tapField(viewport.stageToScene(position, fit));
		}
	}

	function handleContextMenu(e: KonvaEventObject<MouseEvent>) {
		e.evt.preventDefault();
		const node = elementNode(e.target);
		if (node) {
			controller.contextMenu(node.id(), anchorFor(node));
		}
	}
</script>

<svelte:window onresize={() => windowGeometry++} />

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
				oncontextmenu={handleContextMenu}
			>
				<Layer listening={false}>
					<Rect width={viewport.field.width} height={viewport.field.height} fill="white" />
				</Layer>
				<FloorballFullField width={viewport.field.width} height={viewport.field.height} />

				<Layer>
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
								label={element.showsLabel ? element.label : ""}
								labelRotation={0 - fit.rotation}
								onDragStart={(id) => controller.dragStart(id)}
								onDragMove={(_id, position) => controller.dragMove(position)}
								onDragEnd={(id, position) => controller.dragEnd(id, position)}
							/>
						{/if}
					{/each}
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
