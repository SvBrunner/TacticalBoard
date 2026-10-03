<script lang="ts">
	import { Shape } from "svelte-konva";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import type { ElementType } from "$lib/model/elements/ElementType";
	import { drawPlayer, drawBall, drawRectangle, drawTriangle, drawCircle } from "./Shapes";

	export let x = 0;
	export let y = 0;
	export let color = "blue";
	export let type: ElementType = "Player";
	export let id: string;

	const drawFns: Record<ElementType, (context: any, shape: any) => void> = {
		Player: drawPlayer,
		Ball: drawBall,
		Rectangle: drawRectangle,
		Triangle: drawTriangle,
		Circle: drawCircle,
	};

	function handleOnDragEnd(e: any) {
		const newX = e.target.attrs.x;
		const newY = e.target.attrs.y;
		situationEditor.moveElement(id, newX, newY);
		// A drag is one undo step: don't let the next drag merge into this one.
		situationEditor.endGesture();
	}
</script>

<Shape
	name="Component"
	x={x}
	y={y}
	id={id}
	fill={color}
	elementType={type}
	draggable={true}
	sceneFunc={function (context: any, shape: any) {
		const draw = drawFns[type] ?? drawPlayer;
		draw(context, shape);
	}}
	ondragend={handleOnDragEnd}
/>
