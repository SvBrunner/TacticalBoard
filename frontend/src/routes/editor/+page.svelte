<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { goto } from "$app/navigation";
	import Konva from "konva";
	import BoardCanvas from "$lib/components/board/BoardCanvas.svelte";
	import ElementEditPopover from "$lib/components/board/popover/ElementEditPopover.svelte";
	import TopBar from "$lib/components/board/TopBar.svelte";
	import ToolPanel from "$lib/components/board/ToolPanel.svelte";
	import SituationDialogs from "$lib/components/dialogs/SituationDialogs.svelte";
	import SituationDetails from "$lib/components/details/SituationDetails.svelte";
	import FrameDescriptionEditor from "$lib/components/frames/FrameDescriptionEditor.svelte";
	import FrameStrip from "$lib/components/frames/FrameStrip.svelte";
	import { elementCatalog } from "$lib/components/board/ElementCatalog";
	import { isInsideModalDialog } from "$lib/actions/modalDialog";
	import { BoardInteractionController } from "$lib/board/BoardInteractionController";
	import { BoardViewport } from "$lib/board/BoardViewport";
	import { configureKonva } from "$lib/board/konvaSetup";
	import { PopoverState } from "$lib/board/PopoverState";
	import { Selection } from "$lib/board/Selection";
	import { ToolState, type Tool } from "$lib/board/ToolState";
	import { PositionCatalog } from "$lib/model/positions/PositionCatalog";
	import { isArrowElementType } from "$lib/model/elements/ElementType";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { FrameWorkflow } from "$lib/editor/FrameWorkflow";
	import { DEFAULT_SITUATION_TITLE } from "$lib/model/Situation";
	import { notifications } from "$lib/debug/Notifications";
	import { UndoRedoShortcuts } from "$lib/history/UndoRedoShortcuts";

	const elements = situationEditor.elements;
	const situation = situationEditor.situation;
	const history = situationEditor.history;
	const activeFrame = situationEditor.activeFrame;
	const activeFrameNumber = $derived($situation.indexOfFrame($activeFrame.id) + 1);

	// Recomputed only when the sport or field type changes (a new situation).
	const sport = $derived($situation.sport);
	const fieldType = $derived($situation.fieldType);
	const viewport = $derived(BoardViewport.forSituation({ sport, fieldType }));
	const positions = $derived(PositionCatalog.forSport(sport));

	const tools = new ToolState();
	const activeTool = tools.activeTool;
	const playerColor = tools.playerColor;
	const selection = new Selection(elements);
	const selectedId = selection.selectedId;
	const selected = selection.selected;
	const selectedBend = selection.selectedBend;
	const arrowTool = $derived(isArrowElementType($activeTool) ? $activeTool : null);
	const popover = new PopoverState();
	const popoverAnchor = popover.anchor;
	const controller = new BoardInteractionController({
		editor: situationEditor,
		selection,
		tools,
		popover,
		// Delegates to whichever viewport the current situation uses.
		bounds: {
			clamp: (point) => viewport.clamp(point),
			get visibleRect() {
				return viewport.visibleRect;
			},
		},
		neutralColor: elementCatalog.neutralColor,
		arrowColor: elementCatalog.arrowColor,
		log: notifications,
	});
	const prompt = new ConfirmationPrompt();
	const workflow = new SituationWorkflow({
		editor: situationEditor,
		files: new SituationFileTransfer(),
		confirm: (request) => prompt.request(request),
		log: notifications,
	});
	const frames = new FrameWorkflow({
		editor: situationEditor,
		confirm: (request) => prompt.request(request),
		// Element ids repeat across frames: a selection or popover must not carry over.
		beforeFrameSwitch: () => {
			popover.close();
			selection.clear();
		},
		log: notifications,
	});
	const shortcuts = new UndoRedoShortcuts({
		undo: handleUndo,
		redo: handleRedo,
		isBlocked: () => Konva.isDragging(),
	});

	let dialogs: SituationDialogs;

	function handleKeydown(event: KeyboardEvent) {
		// While a modal dialog is open, its keys belong to it.
		if (isInsideModalDialog(event.target)) {
			return;
		}
		if (!shortcuts.handle(event)) {
			controller.keyDown(event);
		}
	}

	function handleSelectTool(tool: Tool) {
		tools.selectTool(tool);
		controller.toolChanged();
		notifications.notify(`Tool: ${tool}`);
	}

	function handleSelectPlayerColor(color: string) {
		tools.selectPlayerColor(color);
		notifications.notify(`Player color: ${elementCatalog.colorName(color)}`);
	}

	function handleUndo() {
		// The popover may target an element the undo removes or changes.
		popover.close();
		workflow.undo();
	}

	function handleRedo() {
		popover.close();
		workflow.redo();
	}

	/** The badge: back to the start page, after "Discard changes?" when there are unsaved changes. */
	async function handleHome() {
		await workflow.leave(async () => {
			popover.close();
			selection.clear();
			controller.toolChanged();
			await goto("/");
		});
	}

	function handleOpened() {
		popover.close();
		selection.clear();
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
	<title>{$situation.displayTitle} · Tactical Board</title>
</svelte:head>

<div class="editor">
	<TopBar
		title={$situation.displayTitle}
		onHome={handleHome}
		onNew={() => dialogs.startNew()}
		onExport={() => workflow.exportCurrent()}
		onLoadFile={(file) => dialogs.importFile(file)}
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

		<main class="workspace">
			<div class="canvas-area">
				<BoardCanvas
					elements={$elements}
					selectedId={$selectedId}
					selectedBend={$selectedBend}
					{controller}
					{viewport}
					{arrowTool}
				/>
			</div>
			<FrameStrip
				frames={$situation.frames}
				activeFrameId={$activeFrame.id}
				{viewport}
				onSelect={(id) => frames.select(id)}
				onAdd={() => frames.add()}
				onDelete={(id) => frames.delete(id)}
				onMove={(id, toIndex) => frames.move(id, toIndex)}
			/>
		</main>

		<SituationDetails
			title={$situation.title}
			description={$situation.description}
			titlePlaceholder={DEFAULT_SITUATION_TITLE}
			onTitleChange={(title) => situationEditor.changeTitle(title)}
			onDescriptionChange={(description) => situationEditor.changeDescription(description)}
		>
			<FrameDescriptionEditor
				frameNumber={activeFrameNumber}
				description={$activeFrame.description}
				onChange={(description) => situationEditor.changeFrameDescription(description)}
				onCommit={() => situationEditor.endGesture()}
			/>
		</SituationDetails>
	</div>

	<ElementEditPopover
		element={$popoverAnchor ? $selected : null}
		anchor={$popoverAnchor}
		bendIndex={$selectedBend}
		actions={situationEditor}
		{positions}
		onClose={() => controller.dismissPopover()}
		onEditShape={() => controller.editShape()}
	/>
</div>

<SituationDialogs bind:this={dialogs} {workflow} {prompt} onOpened={handleOpened} />

<style>
	.editor {
		width: 100%;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		/* Explicit: an implicit auto column would grow to the header's min-content on narrow screens. */
		grid-template-columns: minmax(0, 1fr);
		overflow: hidden;
	}

	.body {
		min-height: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-rows: minmax(0, 1fr);
		grid-template-areas: "tools workspace details";
		overflow: hidden;
	}

	.body > :global(.tool-panel) {
		grid-area: tools;
	}

	.body > :global(.details-panel) {
		grid-area: details;
	}

	.workspace {
		grid-area: workspace;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-columns: minmax(0, 1fr);
	}

	.canvas-area {
		min-width: 0;
		min-height: 0;
		display: flex;
		background-color: var(--bg-canvas);
		background-image: radial-gradient(var(--dot) 1.5px, transparent 1.5px);
		background-size: 22px 22px;
	}

	/* Tablet portrait (and similar windows): the details panel goes below the field, which keeps the width. */
	@media (min-width: 600px) and (max-width: 1023px) and (min-height: 500px) {
		.body {
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			grid-template-areas:
				"tools workspace"
				"tools details";
		}
	}

	/* Phone portrait: details bar, field and frames in the middle, tools as a bottom bar. */
	@media (max-width: 599px) {
		.body {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			grid-template-areas:
				"details"
				"workspace"
				"tools";
		}

		.canvas-area {
			padding-left: env(safe-area-inset-left, 0px);
			padding-right: env(safe-area-inset-right, 0px);
		}
	}

	/* Phone landscape: narrow tool rail on the left, details bar above the field. */
	@media (max-height: 499px) and (min-width: 600px) {
		.body {
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
			grid-template-areas:
				"tools details"
				"tools workspace";
		}

		.canvas-area {
			padding-right: env(safe-area-inset-right, 0px);
		}
	}
</style>
