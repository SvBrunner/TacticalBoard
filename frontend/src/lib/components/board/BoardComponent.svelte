<!--
@component
One element on the board, drawn at its scene position. Its hit area is a
solid circle of `hitRadius` (scene units), which can be larger than the
drawing so it is easy to hit with a finger.

A non-empty `label` is drawn centered on the element, in black or white
depending on the fill. The label never receives pointer events (taps and
drags hit the shape underneath), follows the shape while it is dragged, and
is counter-rotated by `labelRotation` so it stays upright on a rotated stage.
-->
<script lang="ts">
	import { Shape, Text } from "svelte-konva";
	import type { KonvaDragTransformEvent } from "svelte-konva";
	import type { Point } from "$lib/model/Point";
	import type { PointElementType } from "$lib/model/elements/ElementType";
	import { labelContrast } from "./LabelContrast";
	import { drawFunctionFor, drawHitCircle, ELEMENT_NODE_NAME, LABEL_NODE_NAME, LABEL_STYLE } from "./Shapes";

	/** Width of the selection highlight in CSS px, independent of the board scale. */
	const SELECTED_STROKE_WIDTH_PX = 3;
	const SELECTED_STROKE_COLOR = "oklch(24% 0.02 260)";

	interface Props {
		id: string;
		x?: number;
		y?: number;
		color?: string;
		type?: PointElementType;
		hitRadius: number;
		selected?: boolean;
		/** Off while an arrow tool is active: a press on the element then starts an arrow. */
		draggable?: boolean;
		/** Text drawn on the element; empty draws none. */
		label?: string;
		/** Rotation (degrees) of the label relative to the stage; the negated stage rotation keeps it upright. */
		labelRotation?: number;
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
		draggable = true,
		label = "",
		labelRotation = 0,
		onDragStart,
		onDragMove,
		onDragEnd,
	}: Props = $props();

	const sceneFunc = $derived(drawFunctionFor(type));
	const hitFunc = $derived(drawHitCircle(hitRadius));
	const labelColor = $derived(labelContrast.textColorFor(color));

	/** Where the shape is while it is being dragged (the model only changes on drop). */
	let dragPosition = $state<Point | null>(null);
	const labelX = $derived(dragPosition?.x ?? x);
	const labelY = $derived(dragPosition?.y ?? y);

	function handleDragStart() {
		onDragStart?.(id);
	}

	function handleDragMove(e: KonvaDragTransformEvent) {
		if (onDragMove) {
			e.target.position(onDragMove(id, e.target.position()));
		}
		dragPosition = e.target.position();
	}

	function handleDragEnd(e: KonvaDragTransformEvent) {
		dragPosition = null;
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
	{draggable}
	stroke={selected ? SELECTED_STROKE_COLOR : undefined}
	strokeWidth={selected ? SELECTED_STROKE_WIDTH_PX : 0}
	strokeScaleEnabled={false}
	{sceneFunc}
	{hitFunc}
	ondragstart={handleDragStart}
	ondragmove={handleDragMove}
	ondragend={handleDragEnd}
/>
{#if label}
	<Text
		name={LABEL_NODE_NAME}
		x={labelX}
		y={labelY}
		text={label}
		width={LABEL_STYLE.box}
		height={LABEL_STYLE.box}
		offsetX={LABEL_STYLE.box / 2}
		offsetY={LABEL_STYLE.box / 2}
		align="center"
		verticalAlign="middle"
		wrap="none"
		fontSize={LABEL_STYLE.fontSize}
		fontStyle="bold"
		fontFamily={LABEL_STYLE.fontFamily}
		fill={labelColor}
		rotation={labelRotation}
		listening={false}
		perfectDrawEnabled={false}
	/>
{/if}
