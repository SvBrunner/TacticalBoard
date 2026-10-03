<!--
@component
One handle of the selected arrow: a small circle at the arrow's start, end
or a bend, or a smaller "+" in the middle of a segment ("add bend"). It
keeps the same size on screen at every board scale (`scale` = CSS px per
scene unit) and has a hit circle of at least 44 CSS px. Dragging reports
the pointer position; the owner returns where the handle may be (clamped)
and previews the reshaped arrow. After the drop the handle snaps back to
its props, which then carry the new shape.
-->
<script lang="ts">
	import { Shape } from "svelte-konva";
	import type { KonvaDragTransformEvent } from "svelte-konva";
	import type { ArrowHandle } from "$lib/board/ArrowHandle";
	import { BoardViewport } from "$lib/board/BoardViewport";
	import type { Point } from "$lib/model/Point";
	import { ARROW_HANDLE_NODE_NAME, drawHitCircle } from "./Shapes";

	/** Visible radius in CSS px of the handles of points and of the "add bend" handles. */
	const POINT_RADIUS_PX = 8;
	const INSERT_RADIUS_PX = 6;
	const HANDLE_FILL = "white";
	const ACTIVE_FILL = "oklch(62% 0.16 230)";
	const HANDLE_STROKE = "oklch(24% 0.02 260)";

	interface Props {
		arrowId: string;
		handle: ArrowHandle;
		x: number;
		y: number;
		/** CSS px per scene unit. */
		scale: number;
		/** The active bend (it can be removed from the popover). */
		active?: boolean;
		onDragStart?: (handle: ArrowHandle) => void;
		/** Returns where the handle may be while dragged. */
		onDragMove?: (handle: ArrowHandle, point: Point) => Point;
		onDragEnd?: (handle: ArrowHandle, point: Point) => void;
	}

	let { arrowId, handle, x, y, scale, active = false, onDragStart, onDragMove, onDragEnd }: Props = $props();

	const unit = $derived(scale > 0 ? 1 / scale : 1);
	const radius = $derived((handle.isPoint ? POINT_RADIUS_PX : INSERT_RADIUS_PX) * unit);
	const hitFunc = $derived(drawHitCircle(BoardViewport.MIN_TOUCH_RADIUS_PX * unit));
	const sceneFunc = $derived((context: any, shape: any) => {
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * Math.PI);
		context.closePath();
		context.fillStrokeShape(shape);
		if (!handle.isPoint) {
			const arm = radius * 0.55;
			context.beginPath();
			context.moveTo(-arm, 0);
			context.lineTo(arm, 0);
			context.moveTo(0, -arm);
			context.lineTo(0, arm);
			context.strokeShape(shape);
		}
	});

	function handleDragStart() {
		onDragStart?.(handle);
	}

	function handleDragMove(e: KonvaDragTransformEvent) {
		if (onDragMove) {
			e.target.position(onDragMove(handle, e.target.position()));
		}
	}

	function handleDragEnd(e: KonvaDragTransformEvent) {
		const point = e.target.position();
		onDragEnd?.(handle, point);
		e.target.position({ x, y });
	}
</script>

<Shape
	name={ARROW_HANDLE_NODE_NAME}
	staticConfig={true}
	{x}
	{y}
	{arrowId}
	handleKey={handle.key}
	handleKind={handle.kind}
	fill={active ? ACTIVE_FILL : HANDLE_FILL}
	opacity={handle.isPoint ? 1 : 0.85}
	stroke={HANDLE_STROKE}
	strokeWidth={2}
	strokeScaleEnabled={false}
	draggable={true}
	{sceneFunc}
	{hitFunc}
	ondragstart={handleDragStart}
	ondragmove={handleDragMove}
	ondragend={handleDragEnd}
/>
