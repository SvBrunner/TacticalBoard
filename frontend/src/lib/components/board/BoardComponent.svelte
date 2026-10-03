<!--
@component
One element on the board, drawn at its scene position. Its hit area is a
solid circle of `hitRadius` (scene units), which can be larger than the
drawing so it is easy to hit with a finger.
-->
<script lang="ts">
	import { Shape } from "svelte-konva";
	import type { KonvaDragTransformEvent } from "svelte-konva";
	import type { Point } from "$lib/commands/Point";
	import type { ElementType } from "$lib/model/elements/ElementType";
	import { drawFunctionFor, drawHitCircle, ELEMENT_NODE_NAME } from "./Shapes";

	/** Width of the selection highlight in CSS px, independent of the board scale. */
	const SELECTED_STROKE_WIDTH_PX = 3;
	const SELECTED_STROKE_COLOR = "oklch(24% 0.02 260)";

	interface Props {
		id: string;
		x?: number;
		y?: number;
		color?: string;
		type?: ElementType;
		hitRadius: number;
		selected?: boolean;
		onDragStart?: (id: string) => void;
		/** Returns the position the element may move to (e.g. clamped onto the field). */
		onDragMove?: (id: string, position: Point) => Point;
		onDragEnd?: (id: string, position: Point) => void;
	}

	let {
		id,
		x = 0,
		y = 0,
		color = "blue",
		type = "Player",
		hitRadius,
		selected = false,
		onDragStart,
		onDragMove,
		onDragEnd,
	}: Props = $props();

	const sceneFunc = $derived(drawFunctionFor(type));
	const hitFunc = $derived(drawHitCircle(hitRadius));

	function handleDragStart() {
		onDragStart?.(id);
	}

	function handleDragMove(e: KonvaDragTransformEvent) {
		if (onDragMove) {
			e.target.position(onDragMove(id, e.target.position()));
		}
	}

	function handleDragEnd(e: KonvaDragTransformEvent) {
		onDragEnd?.(id, e.target.position());
	}
</script>

<Shape
	name={ELEMENT_NODE_NAME}
	{x}
	{y}
	{id}
	fill={color}
	elementType={type}
	draggable={true}
	stroke={selected ? SELECTED_STROKE_COLOR : undefined}
	strokeWidth={selected ? SELECTED_STROKE_WIDTH_PX : 0}
	strokeScaleEnabled={false}
	{sceneFunc}
	{hitFunc}
	ondragstart={handleDragStart}
	ondragmove={handleDragMove}
	ondragend={handleDragEnd}
/>
