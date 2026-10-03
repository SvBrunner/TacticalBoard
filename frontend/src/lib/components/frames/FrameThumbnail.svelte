<!--
@component
Small static SVG preview of one frame: the field and the frame's elements,
oriented like the board (full field landscape; half field portrait with the
goal at the bottom). Decorative: the surrounding control names the frame.
Re-renders whenever the frame (an immutable value) changes.
-->
<script lang="ts">
	import type { BoardViewport } from "$lib/board/BoardViewport";
	import type { Frame } from "$lib/model/Frame";
	import { FrameThumbnailGeometry } from "./FrameThumbnailGeometry";

	interface Props {
		frame: Frame;
		viewport: BoardViewport;
		/** Rendered height in CSS px; the width follows the field's aspect ratio. */
		height?: number;
	}

	let { frame, viewport, height = 40 }: Props = $props();

	const geometry = $derived(new FrameThumbnailGeometry(viewport));
	const field = $derived(geometry.field);
	const marks = $derived(geometry.marks(frame));
	const arrows = $derived(geometry.arrows(frame));
	const width = $derived((height * geometry.width) / geometry.height);

	/** Points of a triangle like the board's (apex up), scaled to `r` = the triangle's visual radius. */
	function trianglePoints(x: number, y: number, r: number): string {
		const k = r / Math.hypot(18, 15);
		return [
			[x, y - 20 * k],
			[x + 18 * k, y + 15 * k],
			[x - 18 * k, y + 15 * k],
		]
			.map(([px, py]) => `${px},${py}`)
			.join(" ");
	}
</script>

<svg
	class="frame-thumbnail"
	data-field-type={viewport.fieldType}
	viewBox={geometry.viewBox}
	width={width}
	height={height}
	aria-hidden="true"
	focusable="false"
>
	<g class="field" transform={geometry.fieldTransform}>
		<rect
			class="rink"
			x={field.rink.x}
			y={field.rink.y}
			width={field.rink.width}
			height={field.rink.height}
			rx={field.rink.cornerRadius}
		/>
		<line class="line" x1={field.centerLine.x} y1={field.centerLine.y1} x2={field.centerLine.x} y2={field.centerLine.y2} />
		{#each field.goalAreas as area, i (i)}
			<rect class="line" x={area.x} y={area.y} width={area.width} height={area.height} />
		{/each}
		{#each field.goals as goal, i (i)}
			<path class="line" d={goal} />
		{/each}
	</g>
	<g class="arrows">
		{#each arrows as arrow (arrow.id)}
			<g data-element-id={arrow.id} data-type={arrow.type}>
				{#if arrow.path}
					<path
						d={arrow.path}
						fill="none"
						stroke={arrow.color}
						stroke-width={arrow.width}
						stroke-dasharray={arrow.dash}
						stroke-linecap={arrow.dash ? "butt" : "round"}
						stroke-linejoin="round"
					/>
				{/if}
				<polygon points={arrow.head} fill={arrow.color} />
			</g>
		{/each}
	</g>
	<g class="elements">
		{#each marks as mark (mark.id)}
			{#if mark.type === "Rectangle"}
				{@const side = mark.radius * Math.SQRT2}
				<rect data-element-id={mark.id} data-type={mark.type} x={mark.x - side / 2} y={mark.y - side / 2} width={side} height={side} fill={mark.color} />
			{:else if mark.type === "Triangle"}
				<polygon data-element-id={mark.id} data-type={mark.type} points={trianglePoints(mark.x, mark.y, mark.radius)} fill={mark.color} />
			{:else if mark.type === "Circle"}
				<circle data-element-id={mark.id} data-type={mark.type} cx={mark.x} cy={mark.y} r={mark.radius * 0.75} fill="none" stroke={mark.color} stroke-width={mark.radius / 2} />
			{:else}
				<circle data-element-id={mark.id} data-type={mark.type} cx={mark.x} cy={mark.y} r={mark.radius} fill={mark.color} />
			{/if}
		{/each}
	</g>
</svg>

<style>
	.frame-thumbnail {
		display: block;
		flex-shrink: 0;
		border-radius: 4px;
		overflow: hidden;
	}

	.rink {
		fill: white;
		stroke: oklch(30% 0.01 260);
		stroke-width: 16px;
	}

	.line {
		fill: none;
		stroke: oklch(30% 0.01 260 / 0.55);
		stroke-width: 10px;
	}
</style>
