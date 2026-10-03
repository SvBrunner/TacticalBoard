<script lang="ts">
	import { Stage, Layer, Rect } from "svelte-konva";
	import BoardComponent from "$lib/components/board/BoardComponent.svelte";
	import FloorballFullField from "$lib/components/board/background/FloorballFullField.svelte";
	import ContextMenuBoardComponent from "$lib/components/board/contextmenus/ContextMenuBoardComponent.svelte";
	import TopBar from "$lib/components/board/TopBar.svelte";
	import Sidebar from "$lib/components/board/Sidebar.svelte";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import type { ElementType } from "$lib/model/elements/ElementType";
	import { PointElement } from "$lib/model/elements/PointElement";
	import { theme } from "$lib/theme";
	import { notifications } from "$lib/debug/Notifications";
	import NotificationStack from "$lib/debug/NotificationStack.svelte";
	import { onMount } from "svelte";
	import Konva from "konva";
	import { UndoRedoShortcuts } from "$lib/history/UndoRedoShortcuts";

	let contextMenuBoardComponent: ContextMenuBoardComponent;
	let sceneWidth: number = 2000;
	let sceneHeight: number = 1000;
	let baseScale = { x: 1, y: 1 };

	let containerWidth = sceneWidth;
	let containerHeight = sceneHeight;

	let activeTool: "Move" | ElementType = "Player";
	let selectedColor = "oklch(62% 0.16 230)";
	const nonPlayerColor = "oklch(45% 0.01 260)";
	const elements = situationEditor.elements;
	const situation = situationEditor.situation;
	const history = situationEditor.history;
	const fileTransfer = new SituationFileTransfer();
	const shortcuts = new UndoRedoShortcuts({
		undo: handleUndo,
		redo: handleRedo,
		isBlocked: () => Konva.isDragging(),
	});

	function fitStageIntoParentContainer() {
		const container = document.getElementById("stage-parent");
		if (container == null) {
			return;
		}

		const cs = getComputedStyle(container);
		const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
		const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);

		const parentContainerWidth = container.offsetWidth - paddingX - borderX;
		const scale = parentContainerWidth / sceneWidth;

		containerWidth = parentContainerWidth;
		containerHeight = parentContainerWidth * (sceneHeight / sceneWidth);
		baseScale = { x: scale, y: scale };

		notifications.notify(
			`Stage sized to ${Math.round(containerWidth)}×${Math.round(containerHeight)} (scale ${scale.toFixed(3)})`,
		);
	}

	function handleStageOnClick(e: any) {
		const target = e.target;
		const evt = e.evt;
		// getRelativePointerPosition (not getPointerPosition) accounts for the
		// Stage's own scale, giving coordinates in the same units as sceneWidth/Height.
		const pos = target.getStage().getRelativePointerPosition();
		const x = pos.x;
		const y = pos.y;

		if (target.attrs.name === "Component") {
			if (evt.shiftKey) {
				notifications.notify(`Deleted ${target.attrs.elementType} ${target.attrs.id}`);
				situationEditor.removeElement(target.attrs.id);
			}
			return;
		}

		if (activeTool === "Move") {
			notifications.notify(`Click ignored (tool is Move) at (${Math.round(x)}, ${Math.round(y)})`);
			return;
		}

		const color = activeTool === "Player" ? selectedColor : nonPlayerColor;
		situationEditor.addElement(x, y, color, activeTool);
		notifications.notify(`Added ${activeTool} at (${Math.round(x)}, ${Math.round(y)})`);
	}

	function handleStageOnContextMenu(e: any) {
		e.evt.preventDefault();
		const target = e.target;
		if (target.attrs.name === "Component") {
			notifications.notify(`Opened marker menu for ${target.attrs.elementType} ${target.attrs.id}`);
			contextMenuBoardComponent.showRightClickContextMenu(
				e.evt,
				target.attrs.id,
				target.attrs.elementType,
				target.attrs.fill,
			);
		}
	}

	function hideContextMenu() {
		contextMenuBoardComponent.onPageClick(null);
	}

	function handleUndo() {
		// The context menu may target an element the undo removes or changes.
		hideContextMenu();
		const label = situationEditor.undo();
		notifications.notify(label ? `Undo: ${label}` : "Nothing to undo");
	}

	function handleRedo() {
		hideContextMenu();
		const label = situationEditor.redo();
		notifications.notify(label ? `Redo: ${label}` : "Nothing to redo");
	}

	function handleExport() {
		const filename = fileTransfer.export(situationEditor.current());
		notifications.notify(`Exported ${$situation.frames.length} frame(s) to ${filename}`);
	}

	async function handleLoadFile(file: File) {
		notifications.notify(`Loading ${file.name}…`);
		try {
			const imported = await fileTransfer.import(file);
			situationEditor.load(imported);
			notifications.notify(`Loaded "${imported.displayTitle}" from ${file.name}`);
		} catch (err) {
			notifications.notify(`Failed to load ${file.name}: ${(err as Error).message}`, "error");
		}
	}

	onMount(() => {
		fitStageIntoParentContainer();
		window.addEventListener("resize", fitStageIntoParentContainer);
	});
</script>

<svelte:window onkeydown={(e) => shortcuts.handle(e)} />

<svelte:head>
	<title>Tactical Board</title>
	<meta name="description" content="This is the board" />
</svelte:head>

<div class="tb-root {$theme}">
	<TopBar
		title={$situation.displayTitle}
		onExport={handleExport}
		onLoadFile={handleLoadFile}
		canUndo={$history.canUndo}
		canRedo={$history.canRedo}
		onUndo={handleUndo}
		onRedo={handleRedo}
	/>

	<div class="body">
		<Sidebar bind:activeTool bind:selectedColor />

		<div class="canvas-area">
			<div id="stage-parent" class="field-card">
				<Stage
					onclick={handleStageOnClick}
					oncontextmenu={handleStageOnContextMenu}
					onpointerdown={hideContextMenu}
					id="stage"
					width={containerWidth}
					height={containerHeight}
					scale={baseScale}
				>
					<Layer>
						<Rect width={sceneWidth} height={sceneHeight} fill="white" />
					</Layer>
					<FloorballFullField width={sceneWidth} height={sceneHeight} />

					<Layer>
						{#each $elements as element (element.id)}
							{#if element instanceof PointElement}
								<BoardComponent
									x={element.x}
									y={element.y}
									color={element.color}
									type={element.type}
									id={element.id}
								/>
							{/if}
						{/each}
					</Layer>
				</Stage>
			</div>
		</div>
	</div>
</div>

<ContextMenuBoardComponent bind:this={contextMenuBoardComponent} />
<NotificationStack />

<style>
	.tb-root {
		width: 100%;
		height: 100vh;
		background: var(--bg-app);
		color: var(--text);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.body {
		flex-grow: 1;
		display: flex;
		overflow: hidden;
	}

	.canvas-area {
		flex-grow: 1;
		position: relative;
		background-color: var(--bg-canvas);
		background-image: radial-gradient(var(--dot) 1.5px, transparent 1.5px);
		background-size: 22px 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px;
	}

	.field-card {
		width: 100%;
		max-width: 1400px;
		aspect-ratio: 2 / 1;
		background: var(--field-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		border: 1px solid var(--border);
		overflow: hidden;
	}
</style>
