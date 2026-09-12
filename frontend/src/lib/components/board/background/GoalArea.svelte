<script lang="ts">
	import { Rect } from "svelte-konva";

	export let width = 0;
	export let height = 0;
	export let y = 0;
	export let mirrored = false;
	export let distanceBack = width * 0.05 ;

	// Proportions derived from the confirmed board-design mockup geometry:
	// the goal area is flush against the boundary and wraps around the goal.
	let depth = width * 0.112;
	let boxHeight = height * 0.333;
	let boxX = mirrored ? width - depth  - distanceBack: distanceBack;
</script>

<Rect
	x={boxX}
	y={y - boxHeight / 2}
	width={depth}
	height={boxHeight}
	stroke="black"
	strokeWidth={2}
	fill="transparent"
	draggable={false}
/>
