<script lang="ts">
	import { Shape } from "svelte-konva";
	export let x = 0;
	export let y = 0;
	export let width = 0;
	export let height = 0;
	export let mirrored = false;

	let scaleX = mirrored ? -1 : 1;

	// Proportions derived from the confirmed board-design mockup geometry:
	// an open bracket (back wall + two side walls), unfilled, opening
	// toward the field. Origin is the mouth; the back wall sits behind it
	// (toward the boundary), which the caller reaches by passing x/y at
	// the mouth position.
	let goalDepth = width * 0.02;
	let goalHalfWidth = (height * 0.167) / 2;
	let strokeWidth = Math.max(2, width * 0.0015);

	function drawGoal(context: any, shape: any) {
		context.beginPath();
		context.moveTo(0, -goalHalfWidth);
		context.lineTo(-goalDepth, -goalHalfWidth);
		context.lineTo(-goalDepth, goalHalfWidth);
		context.lineTo(0, goalHalfWidth);
		// Deliberately not closed: the mouth stays open toward the field.
		context.fillStrokeShape(shape);
	}
</script>

<Shape
	x={x}
	y={y}
	stroke="black"
	strokeWidth={strokeWidth}
	scaleX={scaleX}
	scaleY={1}
	draggable={false}
	sceneFunc={drawGoal}
/>
