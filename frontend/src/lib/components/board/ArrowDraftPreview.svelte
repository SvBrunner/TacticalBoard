<!--
@component
Preview of the arrow being drawn: a marker at the start point (after the
first tap of tap-tap drawing) and, once there is an end, the arrow itself,
translucent. Never receives pointer events.
-->
<script lang="ts">
	import { Shape } from "svelte-konva";
	import type { ArrowDraft } from "$lib/board/ArrowGestures";
	import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
	import type { ArrowElementType } from "$lib/model/elements/ElementType";
	import ArrowShape from "./ArrowShape.svelte";
	import { ARROW_DRAFT_NODE_NAME } from "./Shapes";

	/** Radius of the start marker in CSS px. */
	const MARKER_RADIUS_PX = 9;

	interface Props {
		draft: ArrowDraft;
		type: ArrowElementType;
		color: string;
		/** CSS px per scene unit. */
		scale: number;
	}

	let { draft, type, color, scale }: Props = $props();

	const markerRadius = $derived(MARKER_RADIUS_PX / (scale > 0 ? scale : 1));
	const markerFunc = $derived((context: any, shape: any) => {
		context.beginPath();
		context.arc(0, 0, markerRadius, 0, 2 * Math.PI);
		context.closePath();
		context.fillStrokeShape(shape);
	});
</script>

<Shape
	name={ARROW_DRAFT_NODE_NAME}
	x={draft.start.x}
	y={draft.start.y}
	fill={color}
	stroke="white"
	strokeWidth={2}
	strokeScaleEnabled={false}
	listening={false}
	sceneFunc={markerFunc}
/>
{#if draft.end}
	<ArrowShape
		id="arrow-draft"
		name={ARROW_DRAFT_NODE_NAME}
		{type}
		{color}
		geometry={ArrowGeometry.straight(draft.start, draft.end)}
		hitWidth={0}
		draggable={false}
		listening={false}
		opacity={0.6}
	/>
{/if}
