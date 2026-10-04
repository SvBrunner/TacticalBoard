<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { goto } from "$app/navigation";
	import Konva from "konva";
	import BoardCanvas from "$lib/components/board/BoardCanvas.svelte";
	import ElementEditPopover from "$lib/components/board/popover/ElementEditPopover.svelte";
	import TopBar from "$lib/components/board/TopBar.svelte";
	import ToolPanel from "$lib/components/board/ToolPanel.svelte";
	import ExportAnimationDialog from "$lib/components/dialogs/ExportAnimationDialog.svelte";
	import SituationDialogs from "$lib/components/dialogs/SituationDialogs.svelte";
	import SituationDetails from "$lib/components/details/SituationDetails.svelte";
	import FrameDescriptionEditor from "$lib/components/frames/FrameDescriptionEditor.svelte";
	import FrameStrip from "$lib/components/frames/FrameStrip.svelte";
	import PlaybackControls from "$lib/components/playback/PlaybackControls.svelte";
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
	import { notifications } from "$lib/debug/Notifications";
	import { UndoRedoShortcuts } from "$lib/history/UndoRedoShortcuts";
	import { PlaybackWorkflow } from "$lib/editor/PlaybackWorkflow";
	import { WebKeyValueStorage } from "$lib/playback/KeyValueStorage";
	import { PlaybackSettingsStore } from "$lib/playback/PlaybackSettings";
	import { PlaybackShortcuts } from "$lib/playback/PlaybackShortcuts";
	import { PlaybackTimeline } from "$lib/playback/PlaybackTimeline";
	import { SlideshowPlayer } from "$lib/playback/SlideshowPlayer";
	import { AnimationExport } from "$lib/export/AnimationExport.svelte";
	import { FrameRasterizer } from "$lib/export/FrameRasterizer.svelte";
	import { GifAnimationEncoder } from "$lib/export/GifAnimationEncoder";
	import { SlideshowExporter } from "$lib/export/SlideshowExporter";
	import { BrowserFileDownloader } from "$lib/files/FileDownloader";
	import { WebFileShare } from "$lib/files/FileShare";
	import { authSession } from "$lib/auth/AuthSession";
	import SaveConflictDialog from "$lib/components/storage/SaveConflictDialog.svelte";
	import SaveStatus from "$lib/components/storage/SaveStatus.svelte";
	import SavedSituationInfo from "$lib/components/storage/SavedSituationInfo.svelte";
	import { ChoicePrompt } from "$lib/dialogs/ChoicePrompt";
	import { EditorRoute } from "$lib/editor/EditorRoute";
	import { SaveShortcut } from "$lib/storage/SaveShortcut";
	import { situationLink } from "$lib/storage/SituationLink";
	import { SituationSaver, type ConflictChoice } from "$lib/storage/SituationSaver";
	import { situationApi, situationSerializer } from "$lib/storage/situationStorage";
	import { defaultTitles, englishMessages, t } from "$lib/i18n";

	const elements = situationEditor.elements;
	const situation = situationEditor.situation;
	const history = situationEditor.history;
	const activeFrame = situationEditor.activeFrame;
	const unsavedChanges = situationEditor.hasUnsavedChanges;
	/** The title as shown: a blank title as the default title of the UI language. */
	const shownTitle = $derived($situation.title.trim() === "" ? $t.situation.defaultTitle : $situation.title);
	const activeFrameNumber = $derived($situation.indexOfFrame($activeFrame.id) + 1);
	const frameCount = $derived($situation.frames.length);

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
		link: situationLink,
		confirm: (request) => prompt.request(request),
		isLoggedIn: () => authSession.current().status === "authenticated",
		log: notifications,
	});

	// Saving on the server (logged in only): Save button, Ctrl/Cmd+S, the conflict question.
	const sessionState = authSession.state;
	const canSave = $derived($sessionState.status === "authenticated");
	const linkState = situationLink.state;
	/** Something to save: never saved on the server, or changed since (arc42 ch. 8.7). */
	const hasChanges = $derived(SituationSaver.hasChanges($linkState, $unsavedChanges));
	const conflictPrompt = new ChoicePrompt<true, ConflictChoice>("cancel");
	const conflictPending = conflictPrompt.pending;
	const saver = new SituationSaver({
		editor: situationEditor,
		link: situationLink,
		api: situationApi,
		serializer: situationSerializer,
		chooseOnConflict: () => conflictPrompt.request(true),
		onSessionEnded: () => void authSession.refresh(),
		isDefaultTitle: (title) => defaultTitles.matches(title),
		// The URL names the saved situation, so a reload restores it.
		onSaved: (saved) => void goto(EditorRoute.forSaved(saved.id), { replaceState: true, keepFocus: true, noScroll: true }),
		log: notifications,
	});
	const saveState = saver.state;
	const saveShortcut = new SaveShortcut({
		save: handleSave,
		canSave: () => authSession.current().status === "authenticated",
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

	// Playback: settings are app-level (remembered in the browser), not part of the situation.
	const playbackSettingsStore = new PlaybackSettingsStore(new WebKeyValueStorage());
	const playbackSettings = playbackSettingsStore.settings;
	const player = new SlideshowPlayer({
		timeline: () => PlaybackTimeline.of(situationEditor.current().frames, playbackSettingsStore.current()),
		loop: () => playbackSettingsStore.current().loop,
	});
	const playbackState = player.state;
	const playback = new PlaybackWorkflow({
		player,
		situation,
		// Leave editing cleanly: the board becomes read-only while the slideshow runs.
		beforeStart: () => {
			situationEditor.endGesture();
			controller.toolChanged(); // drops an arrow being drawn
			popover.close();
			selection.clear();
		},
		log: notifications,
	});
	const playbackKeys = new PlaybackShortcuts(playback);
	/** Playing or paused: the board shows the slideshow and editing is blocked. */
	const playing = $derived($playbackState.status !== "stopped");
	/** The frame on the board: the slideshow's during playback, otherwise the active frame. */
	const shownFrame = $derived(
		$playbackState.status === "stopped" ? $activeFrame : ($situation.findFrame($playbackState.frameId) ?? $activeFrame),
	);
	const shownFrameNumber = $derived($situation.indexOfFrame(shownFrame.id) + 1);

	// GIF export: the frames as the slideshow shows them, drawn off screen like the board.
	const animationExport = new AnimationExport({
		exporter: new SlideshowExporter({
			renderer: (exportViewport, size) => new FrameRasterizer(exportViewport, size),
			encoder: () => GifAnimationEncoder.create(),
		}),
		downloader: new BrowserFileDownloader(),
		share: new WebFileShare(),
		log: notifications,
	});
	let exportAnimationOpen = $state(false);

	let dialogs: SituationDialogs;

	/** Opens the GIF export for the situation as it is now; a running slideshow stops first. */
	function handleExportAnimation() {
		playback.stop();
		situationEditor.endGesture();
		popover.close();
		animationExport.begin({ situation: situationEditor.current(), settings: playbackSettingsStore.current() });
		exportAnimationOpen = true;
	}

	function handleSave() {
		void saver.save();
	}

	function handleKeydown(event: KeyboardEvent) {
		// Ctrl/Cmd+S saves from anywhere, text fields included (not inside modal dialogs).
		if (saveShortcut.handle(event)) {
			return;
		}
		// While a modal dialog is open, its keys belong to it.
		if (isInsideModalDialog(event.target) || Konva.isDragging()) {
			return;
		}
		if (playbackKeys.handle(event) || player.isActive()) {
			// During playback the board is read-only: no undo/redo, Delete or Escape for it.
			return;
		}
		if (!shortcuts.handle(event)) {
			controller.keyDown(event);
		}
	}

	/** A tap on a frame of the strip: during playback the slideshow shows it, otherwise it becomes active. */
	function handleSelectFrame(frameId: string) {
		if (player.isActive()) {
			playback.showFrame($situation.indexOfFrame(frameId));
		} else {
			frames.select(frameId);
		}
	}

	function handleSelectTool(tool: Tool) {
		if (player.isActive()) {
			return;
		}
		tools.selectTool(tool);
		controller.toolChanged();
		notifications.notify(`Tool: ${tool}`);
	}

	function handleSelectPlayerColor(color: string) {
		if (player.isActive()) {
			return;
		}
		tools.selectPlayerColor(color);
		notifications.notify(`Player color: ${elementCatalog.colorName(color, englishMessages)}`);
	}

	function handleUndo() {
		if (player.isActive()) {
			return;
		}
		// The popover may target an element the undo removes or changes.
		popover.close();
		workflow.undo();
	}

	function handleRedo() {
		if (player.isActive()) {
			return;
		}
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
		// A save message belongs to the replaced situation; a new one has no saved URL.
		saver.dismiss();
		void goto(EditorRoute.PATH, { replaceState: true, keepFocus: true, noScroll: true });
	}

	onMount(() => {
		configureKonva();
	});

	onDestroy(() => {
		animationExport.close();
		playback.destroy();
		selection.destroy();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{$t.app.pageTitle(shownTitle)}</title>
</svelte:head>

<div class="editor">
	<TopBar
		title={shownTitle}
		onHome={handleHome}
		onNew={() => dialogs.startNew()}
		onExportJson={() => workflow.exportCurrent()}
		onExportAnimation={handleExportAnimation}
		onLoadFile={(file) => dialogs.importFile(file)}
		canUndo={$history.canUndo && !playing}
		canRedo={$history.canRedo && !playing}
		onUndo={handleUndo}
		onRedo={handleRedo}
		onSave={canSave ? handleSave : undefined}
		loginReturnTo={$linkState.kind === "saved" ? EditorRoute.forSaved($linkState.summary.id) : "/"}
		saving={$saveState.status === "saving"}
		{hasChanges}
	>
		{#snippet status()}
			<SaveStatus state={$saveState} onDismiss={() => saver.dismiss()} />
		{/snippet}
	</TopBar>

	<div class="body">
		<ToolPanel
			activeTool={$activeTool}
			playerColor={$playerColor}
			onSelectTool={handleSelectTool}
			onSelectPlayerColor={handleSelectPlayerColor}
			disabled={playing}
		/>

		<main class="workspace">
			<div class="canvas-area">
				<BoardCanvas
					elements={shownFrame.elements}
					selectedId={playing ? null : $selectedId}
					selectedBend={playing ? null : $selectedBend}
					{controller}
					{viewport}
					arrowTool={playing ? null : arrowTool}
					readonly={playing}
				/>
			</div>
			<PlaybackControls
				status={$playbackState.status}
				frameNumber={shownFrameNumber}
				{frameCount}
				canPlay={frameCount >= 2}
				frameDurationMs={$playbackSettings.frameDurationMs}
				loop={$playbackSettings.loop}
				onTogglePlay={() => playback.toggle()}
				onPrevious={() => playback.previous()}
				onNext={() => playback.next()}
				onStop={() => playback.stop()}
				onFrameDurationChange={(ms) => playbackSettingsStore.setFrameDuration(ms)}
				onLoopChange={(loop) => playbackSettingsStore.setLoop(loop)}
			/>
			<FrameStrip
				frames={$situation.frames}
				activeFrameId={shownFrame.id}
				{viewport}
				{playing}
				onSelect={handleSelectFrame}
				onAdd={() => !player.isActive() && frames.add()}
				onDelete={(id) => !player.isActive() && frames.delete(id)}
				onMove={(id, toIndex) => !player.isActive() && frames.move(id, toIndex)}
			/>
		</main>

		<SituationDetails
			title={$situation.title}
			description={$situation.description}
			titlePlaceholder={$t.situation.defaultTitle}
			onTitleChange={(title) => !player.isActive() && situationEditor.changeTitle(title)}
			onDescriptionChange={(description) => !player.isActive() && situationEditor.changeDescription(description)}
			disabled={playing}
		>
			{#if $linkState.kind === "saved"}
				<SavedSituationInfo summary={$linkState.summary} />
			{/if}
			<!-- Frame descriptions are not shown during playback. -->
			{#if !playing}
				<FrameDescriptionEditor
					frameNumber={activeFrameNumber}
					description={$activeFrame.description}
					onChange={(description) => situationEditor.changeFrameDescription(description)}
					onCommit={() => situationEditor.endGesture()}
				/>
			{/if}
		</SituationDetails>
	</div>

	<ElementEditPopover
		element={$popoverAnchor && !playing ? $selected : null}
		anchor={$popoverAnchor}
		bendIndex={$selectedBend}
		actions={situationEditor}
		{positions}
		onClose={() => controller.dismissPopover()}
		onEditShape={() => controller.editShape()}
	/>
</div>

<SituationDialogs bind:this={dialogs} {workflow} {prompt} onOpened={handleOpened} />

<SaveConflictDialog open={$conflictPending !== null} onChoose={(choice) => conflictPrompt.answer(choice)} />

<ExportAnimationDialog open={exportAnimationOpen} flow={animationExport} onClose={() => (exportAnimationOpen = false)} />

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
		grid-template-rows: minmax(0, 1fr) auto auto;
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

	/* Wider landscape phones: height is scarce, so the playback controls sit next to the frame
	   strip instead of above it (narrower ones need the whole width for the strip). */
	@media (max-height: 499px) and (min-width: 780px) {
		.workspace {
			grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
		}

		.canvas-area {
			grid-column: 1 / -1;
		}
	}
</style>
