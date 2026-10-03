<!--
@component
One arrow on the board, drawn by `ArrowPainter` in scene units (the node
itself sits at the origin). Its hit region is the curve stroked
`hitWidth` wide (scene units), so a thin pass line is still easy to tap.
Dragging the arrow moves it as a whole: Konva offsets the node while it is
dragged (the model only changes on drop) and the offset is reset after the
drop, when the moved shape comes back through the props (`staticConfig`
keeps svelte-konva from writing the dragged offset back into the props).
-->
<script lang="ts">
	import { Shape } from "svelte-konva";
	import type { KonvaDragTransformEvent } from "svelte-konva";
	import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
	import type { ArrowElementType } from "$lib/model/elements/ElementType";
	import type { Point } from "$lib/model/Point";
	import { ArrowPainter } from "./ArrowPainter";
	import { ARROW_NODE_NAME } from "./Shapes";

	interface Props {
		id: string;
		type: ArrowElementType;
		color: string;
		geometry: ArrowGeometry;
		/** Width of the hit region along the curve, in scene units. */
		hitWidth: number;
		draggable?: boolean;
		/** Whether the arrow receives pointer events (off for the drawing preview). */
		listening?: boolean;
		opacity?: number;
		painter?: ArrowPainter;
		/** Konva node name; arrows of the frame keep the default. */
		name?: string;
		onDragStart?: (id: string) => void;
		/** Returns how far the arrow may be moved (e.g. so it stays on the field). */
		onDragMove?: (id: string, delta: Point) => Point;
		onDragEnd?: (id: string, delta: Point) => void;
	}

	let {
		id,
		type,
		color,
		geometry,
		hitWidth,
		draggable = true,
		listening = true,
		opacity = 1,
		painter = new ArrowPainter(),
		name = ARROW_NODE_NAME,
		onDragStart,
		onDragMove,
		onDragEnd,
	}: Props = $props();

	const sceneFunc = $derived((context: any) => painter.paint(context, geometry, type, color));
	const hitFunc = $derived((context: any, shape: any) => {
		painter.traceCurve(context, geometry);
		context.strokeShape(shape);
	});

	function handleDragStart() {
		onDragStart?.(id);
	}

	function handleDragMove(e: KonvaDragTransformEvent) {
		if (onDragMove) {
			e.target.position(onDragMove(id, e.target.position()));
		}
	}

	function handleDragEnd(e: KonvaDragTransformEvent) {
		const delta = e.target.position();
		onDragEnd?.(id, delta);
		e.target.position({ x: 0, y: 0 });
	}
</script>

<Shape
	{name}
	{id}
	staticConfig={true}
	x={0}
	y={0}
	elementType={type}
	{draggable}
	{listening}
	{opacity}
	hitStrokeWidth={hitWidth}
	lineCap="round"
	lineJoin="round"
	perfectDrawEnabled={false}
	{sceneFunc}
	{hitFunc}
	ondragstart={handleDragStart}
	ondragmove={handleDragMove}
	ondragend={handleDragEnd}
/>
