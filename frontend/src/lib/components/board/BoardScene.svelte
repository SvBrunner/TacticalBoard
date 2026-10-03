<!--
@component
The drawing of the board: a Konva stage laid out by `fit` (see
`BoardViewport.fit`) with the field and the given elements. Shared by the
interactive board (`BoardCanvas`) and the GIF export, so both draw exactly
the same picture.

Elements are drawn in one layer, in three groups from bottom to top:
arrows (always below), point elements, and the `overlay` snippet (the
owner's extras, e.g. arrow handles).

Without `interaction` the scene is a picture only: nothing listens, is
draggable or selected. The field is always drawn in the light look (white
surface, black lines), independent of the app theme.

`toCanvas()` renders the current scene into a new canvas of the stage's
size (1 pixel per CSS px).
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { Stage, Layer, Rect, Group } from "svelte-konva";
	import type { BoardViewport, StageFit } from "$lib/board/BoardViewport";
	import { ArrowElement } from "$lib/model/elements/ArrowElement";
	import type { BoardElement } from "$lib/model/elements/BoardElement";
	import { PointElement } from "$lib/model/elements/PointElement";
	import ArrowShape from "./ArrowShape.svelte";
	import BoardComponent from "./BoardComponent.svelte";
	import FloorballFullField from "./background/FloorballFullField.svelte";
	import type { SceneInteraction, SceneStageEvents } from "./SceneInteraction";
	import { FIELD_SURFACE_COLOR, visualRadius } from "./Shapes";

	interface Props {
		elements: readonly BoardElement[];
		viewport: BoardViewport;
		fit: StageFit;
		interaction?: SceneInteraction | null;
		/** Stage-level pointer events (registered once, when the scene is created). */
		stageEvents?: SceneStageEvents;
		overlay?: Snippet;
	}

	let { elements, viewport, fit, interaction = null, stageEvents = {}, overlay }: Props = $props();

	let stage: ReturnType<typeof Stage> | undefined = $state();

	const listening = $derived(interaction?.listening ?? false);
	const draggable = $derived(interaction?.draggable ?? false);

	/** Renders the scene as it is now into a new canvas of the stage's size. */
	export function toCanvas(): HTMLCanvasElement {
		if (!stage) {
			throw new Error("The board scene is not mounted");
		}
		return stage.node.toCanvas({ pixelRatio: 1 });
	}
</script>

<Stage
	bind:this={stage}
	width={fit.width}
	height={fit.height}
	scaleX={fit.scale}
	scaleY={fit.scale}
	rotation={fit.rotation}
	x={fit.x}
	y={fit.y}
	{...stageEvents}
>
	<Layer listening={false}>
		<Rect width={viewport.field.width} height={viewport.field.height} fill={FIELD_SURFACE_COLOR} />
	</Layer>
	<FloorballFullField width={viewport.field.width} height={viewport.field.height} />

	<Layer {listening}>
		<Group name="arrows">
			{#each elements as element (element.id)}
				{#if element instanceof ArrowElement}
					<ArrowShape
						id={element.id}
						type={element.type}
						color={element.color}
						geometry={interaction ? interaction.arrowGeometry(element) : element.geometry}
						hitWidth={interaction?.arrowHitWidth ?? 0}
						{draggable}
						onDragStart={() => interaction?.arrowDragStart(element)}
						onDragMove={(_id, delta) => interaction?.arrowDragMove(element, delta) ?? delta}
						onDragEnd={(_id, delta) => interaction?.arrowDragEnd(element, delta)}
					/>
				{/if}
			{/each}
		</Group>
		<Group name="points">
			{#each elements as element (element.id)}
				{#if element instanceof PointElement}
					<BoardComponent
						id={element.id}
						x={element.x}
						y={element.y}
						color={element.color}
						type={element.type}
						hitRadius={interaction ? interaction.hitRadius(element.type) : visualRadius(element.type)}
						selected={interaction !== null && element.id === interaction.selectedId}
						{draggable}
						label={element.showsLabel ? element.label : ""}
						labelRotation={0 - fit.rotation}
						onDragStart={(id) => interaction?.pointDragStart(id)}
						onDragMove={(_id, position) => interaction?.pointDragMove(position) ?? position}
						onDragEnd={(id, position) => interaction?.pointDragEnd(id, position)}
					/>
				{/if}
			{/each}
		</Group>
		<Group name="overlay">
			{@render overlay?.()}
		</Group>
	</Layer>
</Stage>
