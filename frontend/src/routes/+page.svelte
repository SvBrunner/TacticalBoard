<!--
@component
Start page (overview): start a new situation or import one from a file;
either opens the editor, and its first save on the server goes to the top
level of the personal area. On top the shared app navbar (`AppNavbar`) with
the account corner (log in / the user's menu). "Saved situations" shows the
personal area when logged in (arc42 ch. 8.15): its folders (links to their
pages, "New folder") and the situations at its top level (open, move,
delete); otherwise it explains why there are none. Teams follow later
(Phase 2).
-->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { AuthSession, authSession } from "$lib/auth/AuthSession";
	import AppNavbar from "$lib/components/navigation/AppNavbar.svelte";
	import FolderNameDialog from "$lib/components/storage/FolderNameDialog.svelte";
	import MoveSituationDialog from "$lib/components/storage/MoveSituationDialog.svelte";
	import SavedFolders from "$lib/components/storage/SavedFolders.svelte";
	import SavedSituations from "$lib/components/storage/SavedSituations.svelte";
	import StartActions from "$lib/components/storage/StartActions.svelte";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { notifications } from "$lib/debug/Notifications";
	import { FolderList } from "$lib/storage/FolderList";
	import { SavedSituationActions } from "$lib/storage/SavedSituationActions";
	import { SavedSituationList } from "$lib/storage/SavedSituationList";
	import { TOP_LEVEL } from "$lib/storage/SaveTarget";
	import type { SituationSummary } from "$lib/storage/SituationApi";
	import { situationLink } from "$lib/storage/SituationLink";
	import { folderApi, situationApi, situationOpener } from "$lib/storage/situationStorage";

	const prompt = new ConfirmationPrompt();
	const workflow = new SituationWorkflow({
		editor: situationEditor,
		files: new SituationFileTransfer(),
		link: situationLink,
		confirm: (request) => prompt.request(request),
		log: notifications,
	});

	const loginNotice = AuthSession.loginNotice(window.location.search);

	const sessionState = authSession.state;
	const refreshSession = () => void authSession.refresh();
	const savedList = new SavedSituationList({
		api: situationApi,
		place: TOP_LEVEL,
		link: situationLink,
		onSessionEnded: refreshSession,
		log: notifications,
	});
	const savedState = savedList.state;
	const folders = new FolderList({ api: folderApi, onSessionEnded: refreshSession, log: notifications });
	const folderState = folders.state;
	const actions = new SavedSituationActions({
		list: savedList,
		opener: situationOpener,
		confirmDiscard: () => workflow.confirmDiscardIfDirty(),
		confirm: (request) => prompt.request(request),
		navigate: (url) => goto(url),
	});
	const actionState = actions.state;

	let creatingFolder = $state(false);
	let moving: SituationSummary | null = $state(null);
	const authenticated = $derived($sessionState.status === "authenticated");
	const folderItems = $derived($folderState.status === "loaded" ? $folderState.folders : []);
	const hasFolders = $derived(folderItems.length > 0);

	// The lists belong to the logged-in user: (re)load them whenever the login state says so.
	$effect(() => {
		if ($sessionState.status === "authenticated") {
			void savedList.load();
			void folders.load();
		}
	});

	function openEditor() {
		void goto("/editor");
	}

	function move(situation: SituationSummary, folderId: string | null) {
		moving = null;
		void actions.move(situation, folderId);
	}
</script>

<svelte:head>
	<title>Tactical Board</title>
	<meta name="description" content="Tactics board for floorball situations." />
</svelte:head>

<AppNavbar title="Tactical Board" home loginReturnTo="/" {loginNotice} />

<main class="start">
	<section class="panel" aria-labelledby="start-heading">
		<h2 id="start-heading" class="panel-title">Start</h2>
		<StartActions {workflow} {prompt} target={TOP_LEVEL} onOpened={openEditor} />
	</section>

	<section class="panel" aria-labelledby="saved-heading">
		<h2 id="saved-heading" class="panel-title">Saved situations</h2>
		{#if $actionState.error}
			<p class="open-error" role="alert">{$actionState.error}</p>
		{/if}
		{#if authenticated}
			<section class="part" aria-labelledby="folders-heading">
				<div class="part-head">
					<h3 id="folders-heading" class="part-title">Folders</h3>
					<button type="button" class="new-folder" onclick={() => (creatingFolder = true)}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
							<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
							<path d="M12 11v5M9.5 13.5h5" />
						</svg>
						New folder
					</button>
				</div>
				<SavedFolders list={$folderState} onRetry={() => void folders.load()} />
			</section>
			<section class="part" aria-labelledby="top-level-heading">
				<h3 id="top-level-heading" class="part-title">Situations</h3>
				{@render situationList()}
			</section>
		{:else}
			{@render situationList()}
		{/if}
	</section>
</main>

{#snippet situationList()}
	<SavedSituations
		session={$sessionState}
		list={$savedState}
		busy={$actionState.opening}
		emptyMessage={hasFolders ? "No situations outside the folders." : undefined}
		onOpen={(situation) => void actions.open(situation)}
		onDelete={(situation) => void actions.delete(situation)}
		onMove={(situation) => (moving = situation)}
		onRetry={() => void savedList.load()}
	/>
{/snippet}

<FolderNameDialog
	open={creatingFolder}
	title="New folder"
	submitLabel="Create"
	onSubmit={(name) => folders.create(name)}
	onClose={() => (creatingFolder = false)}
/>

<MoveSituationDialog situation={moving} folders={folderItems} onMove={move} onCancel={() => (moving = null)} />

<style>
	.start {
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 32px 24px;
		padding-left: calc(24px + env(safe-area-inset-left, 0px));
		padding-right: calc(24px + env(safe-area-inset-right, 0px));
		padding-bottom: calc(48px + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.panel {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.panel-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.part {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.part-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px;
	}

	.part-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.new-folder {
		min-height: var(--touch-target);
		padding: 0 12px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.new-folder:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.open-error {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--danger);
	}

	@media (max-width: 599px) {
		.start {
			padding-top: 16px;
			padding-left: calc(16px + env(safe-area-inset-left, 0px));
			padding-right: calc(16px + env(safe-area-inset-right, 0px));
			gap: 16px;
		}

		.panel {
			padding: 16px;
			border-radius: var(--radius-md);
		}
	}
</style>
