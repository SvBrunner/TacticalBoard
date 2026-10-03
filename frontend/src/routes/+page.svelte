<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import Konva from "konva";
	import BoardCanvas from "$lib/components/board/BoardCanvas.svelte";
	import ElementEditPopover from "$lib/components/board/popover/ElementEditPopover.svelte";
	import TopBar from "$lib/components/board/TopBar.svelte";
	import ToolPanel from "$lib/components/board/ToolPanel.svelte";
	import { elementCatalog } from "$lib/components/board/ElementCatalog";
	import { BoardInteractionController } from "$lib/board/BoardInteractionController";
	import { BoardViewport } from "$lib/board/BoardViewport";
	import { configureKonva } from "$lib/board/konvaSetup";
	import { PopoverState } from "$lib/board/PopoverState";
	import { Selection } from "$lib/board/Selection";
	import { ToolState, type Tool } from "$lib/board/ToolState";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { theme } from "$lib/theme";
	import { notifications } from "$lib/debug/Notifications";
	import NotificationStack from "$lib/debug/NotificationStack.svelte";
	import { UndoRedoShortcuts } from "$lib/history/UndoRedoShortcuts";

	const elements = situationEditor.elements;
	const situation = situationEditor.situation;
	const history = situationEditor.history;

	const viewport = new BoardViewport(2000, 1000);
	const tools = new ToolState();
	const activeTool = tools.activeTool;
	const playerColor = tools.playerColor;
	const selection = new Selection(elements);
	const selectedId = selection.selectedId;
	const selected = selection.selected;
	const popover = new PopoverState();
	const popoverAnchor = popover.anchor;
	const controller = new BoardInteractionController({
		editor: situationEditor,
		selection,
		tools,
		popover,
		bounds: viewport,
		neutralColor: elementCatalog.neutralColor,
		log: notifications,
	});
	const fileTransfer = new SituationFileTransfer();
	const shortcuts = new UndoRedoShortcuts({
		undo: handleUndo,
		redo: handleRedo,
		isBlocked: () => Konva.isDragging(),
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!shortcuts.handle(event)) {
			controller.keyDown(event);
		}
	}

	function handleSelectTool(tool: Tool) {
		tools.selectTool(tool);
		notifications.notify(`Tool: ${tool}`);
	}

	function handleSelectPlayerColor(color: string) {
		tools.selectPlayerColor(color);
		const name = elementCatalog.playerColors.find((c) => c.value === color)?.name ?? color;
		notifications.notify(`Player color: ${name}`);
	}

	function handleUndo() {
		// The popover may target an element the undo removes or changes.
		popover.close();
		const label = situationEditor.undo();
		notifications.notify(label ? `Undo: ${label}` : "Nothing to undo");
	}

	function handleRedo() {
		popover.close();
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
			popover.close();
			situationEditor.load(imported);
			notifications.notify(`Loaded "${imported.displayTitle}" from ${file.name}`);
		} catch (err) {
			notifications.notify(`Failed to load ${file.name}: ${(err as Error).message}`, "error");
		}
	}

	onMount(() => {
		configureKonva();
	});

	onDestroy(() => {
		selection.destroy();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

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
		<ToolPanel
			activeTool={$activeTool}
			playerColor={$playerColor}
			onSelectTool={handleSelectTool}
			onSelectPlayerColor={handleSelectPlayerColor}
		/>

		<main class="canvas-area">
			<BoardCanvas elements={$elements} selectedId={$selectedId} {controller} {viewport} />
		</main>
	</div>

	<ElementEditPopover
		element={$popoverAnchor ? $selected : null}
		anchor={$popoverAnchor}
		actions={situationEditor}
		onClose={() => popover.close()}
	/>
</div>

<NotificationStack />

<style>
	.tb-root {
		width: 100%;
		height: 100vh;
		height: 100dvh;
		background: var(--bg-app);
		color: var(--text);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		/* Explicit: an implicit auto column would grow to the header's min-content on narrow screens. */
		grid-template-columns: minmax(0, 1fr);
		overflow: hidden;
	}

	.body {
		min-height: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-areas: "tools field";
		overflow: hidden;
	}

	.body > :global(.tool-panel) {
		grid-area: tools;
	}

	.canvas-area {
		grid-area: field;
		min-width: 0;
		min-height: 0;
		display: flex;
		background-color: var(--bg-canvas);
		background-image: radial-gradient(var(--dot) 1.5px, transparent 1.5px);
		background-size: 22px 22px;
		padding-right: env(safe-area-inset-right, 0px);
	}

	/* Phone portrait: field in the middle, tools as a bottom bar. */
	@media (max-width: 599px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			grid-template-areas:
				"field"
				"tools";
		}

		.canvas-area {
			padding-left: env(safe-area-inset-left, 0px);
		}
	}
</style>
