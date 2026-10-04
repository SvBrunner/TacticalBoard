<!--
@component
The content of a folder's page (`/folders/<id>`, deep-linkable; arc42 ch. 8.8, 8.15): the
shared navbar with the folder's name as title, a breadcrumb back to the start
page, the folder's actions (Rename, Delete — refused with the reason while
it contains situations), "New situation" and "Import" whose first save goes
into this folder, and the folder's situations (open, move, delete). Without
login or server it explains why it can't show the folder; a folder that
doesn't exist (any more) says so.
-->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { authSession } from "$lib/auth/AuthSession";
	import AppNavbar from "$lib/components/navigation/AppNavbar.svelte";
	import FolderNameDialog from "$lib/components/storage/FolderNameDialog.svelte";
	import MoveSituationDialog from "$lib/components/storage/MoveSituationDialog.svelte";
	import SavedSituations from "$lib/components/storage/SavedSituations.svelte";
	import StartActions from "$lib/components/storage/StartActions.svelte";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { notifications } from "$lib/debug/Notifications";
	import { CurrentFolder } from "$lib/storage/CurrentFolder";
	import { FolderList } from "$lib/storage/FolderList";
	import { FolderRoute } from "$lib/storage/FolderRoute";
	import { SavedSituationActions } from "$lib/storage/SavedSituationActions";
	import { SavedSituationList } from "$lib/storage/SavedSituationList";
	import { inFolder } from "$lib/storage/SaveTarget";
	import type { SituationSummary } from "$lib/storage/SituationApi";
	import { situationLink } from "$lib/storage/SituationLink";
	import { folderApi, situationApi, situationOpener } from "$lib/storage/situationStorage";

	interface Props {
		/** The folder; fixed for the component's life (the route re-creates it for another folder). */
		folderId: string;
	}

	let props: Props = $props();

	// svelte-ignore state_referenced_locally
	const folderId = props.folderId;
	const target = inFolder(folderId);
	const prompt = new ConfirmationPrompt();
	const workflow = new SituationWorkflow({
		editor: situationEditor,
		files: new SituationFileTransfer(),
		link: situationLink,
		confirm: (request) => prompt.request(request),
		log: notifications,
	});

	const sessionState = authSession.state;
	const refreshSession = () => void authSession.refresh();
	const folder = new CurrentFolder({ api: folderApi, id: folderId, onSessionEnded: refreshSession, log: notifications });
	const folderState = folder.state;
	const savedList = new SavedSituationList({
		api: situationApi,
		place: target,
		link: situationLink,
		onSessionEnded: refreshSession,
		log: notifications,
	});
	const savedState = savedList.state;
	const folders = new FolderList({ api: folderApi, onSessionEnded: refreshSession, log: notifications });
	const folderListState = folders.state;
	const actions = new SavedSituationActions({
		list: savedList,
		opener: situationOpener,
		confirmDiscard: () => workflow.confirmDiscardIfDirty(),
		confirm: (request) => prompt.request(request),
		navigate: (url) => goto(url),
	});
	const actionState = actions.state;

	let renaming = $state(false);
	let folderError: string | null = $state(null);
	let moving: SituationSummary | null = $state(null);
	const name = $derived($folderState.status === "loaded" ? $folderState.folder.name : null);
	const otherPlaces = $derived($folderListState.status === "loaded" ? $folderListState.folders : []);

	$effect(() => {
		if ($sessionState.status === "authenticated") {
			void folder.load();
			void savedList.load();
			void folders.load();
		}
	});

	function openEditor() {
		void goto("/editor");
	}

	async function deleteFolder() {
		folderError = null;
		const outcome = await folder.requestDelete({
			containsSituations: savedList.situations().length > 0,
			confirm: (request) => prompt.request(request),
		});
		if (outcome.status === "deleted") {
			await goto("/");
		} else if (outcome.status === "refused") {
			folderError = outcome.message;
		}
	}

	function move(situation: SituationSummary, destination: string | null) {
		moving = null;
		// The folder's content changes: an earlier "can't be deleted" no longer applies.
		folderError = null;
		void actions.move(situation, destination);
	}

	async function deleteSituation(situation: SituationSummary) {
		if (await actions.delete(situation)) {
			folderError = null;
		}
	}

	function rename() {
		folderError = null;
		renaming = true;
	}
</script>

<svelte:head>
	<title>{name ? `${name} – Tactical Board` : "Folder – Tactical Board"}</title>
</svelte:head>

<AppNavbar title={name ?? "Folder"} loginReturnTo={FolderRoute.forFolder(folderId)} />

<main class="folder-page">
	<nav aria-label="Breadcrumb" class="breadcrumb">
		<ol>
			<li><a href="/">Start page</a></li>
			<li><span aria-current="page">{name ?? "Folder"}</span></li>
		</ol>
	</nav>

	{#if $sessionState.status === "anonymous"}
		<p class="hint">Log in to see your folders.</p>
	{:else if $sessionState.status === "unavailable"}
		<p class="hint">Folders need the server, which can't be reached. Creating, editing, export and import work as usual on the start page.</p>
	{:else if $sessionState.status === "authenticated"}
		{#if $folderState.status === "loading"}
			<p class="hint" role="status">Loading folder…</p>
		{:else if $folderState.status === "missing"}
			<p class="hint">This folder doesn't exist (any more). <a href="/">Back to the start page</a></p>
		{:else if $folderState.status === "failed"}
			<div class="failure" role="alert">
				<p class="hint">{$folderState.message}</p>
				<button type="button" class="tool" onclick={() => void folder.load()}>Try again</button>
			</div>
		{:else}
			<section class="panel" aria-labelledby="folder-heading">
				<h2 id="folder-heading" class="panel-title">Folder</h2>
				<ul class="tools">
					<li>
						<button type="button" class="tool" onclick={rename}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M4 20h4L19 9l-4-4L4 16z" />
								<path d="M13.5 6.5l4 4" />
							</svg>
							Rename
						</button>
					</li>
					<li>
						<button type="button" class="tool danger" onclick={() => void deleteFolder()}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
							</svg>
							Delete folder
						</button>
					</li>
				</ul>
				{#if folderError}
					<p class="error" role="alert">{folderError}</p>
				{/if}
			</section>

			<section class="panel" aria-labelledby="start-heading">
				<h2 id="start-heading" class="panel-title">Start in this folder</h2>
				<StartActions {workflow} {prompt} {target} onOpened={openEditor} />
			</section>

			<section class="panel" aria-labelledby="situations-heading">
				<h2 id="situations-heading" class="panel-title">Situations</h2>
				{#if $actionState.error}
					<p class="error" role="alert">{$actionState.error}</p>
				{/if}
				<SavedSituations
					session={$sessionState}
					list={$savedState}
					busy={$actionState.opening}
					emptyMessage="This folder is empty. Start a new situation or import one here, or move situations into it."
					onOpen={(situation) => void actions.open(situation)}
					onDelete={(situation) => void deleteSituation(situation)}
					onMove={(situation) => (moving = situation)}
					onRetry={() => void savedList.load()}
				/>
			</section>
		{/if}
	{/if}
</main>

<FolderNameDialog
	open={renaming}
	title="Rename folder"
	submitLabel="Rename"
	initialName={name ?? ""}
	onSubmit={(newName) => folder.rename(newName)}
	onClose={() => (renaming = false)}
/>

<MoveSituationDialog situation={moving} folders={otherPlaces} onMove={move} onCancel={() => (moving = null)} />

<style>
	.folder-page {
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 24px;
		padding-left: calc(24px + env(safe-area-inset-left, 0px));
		padding-right: calc(24px + env(safe-area-inset-right, 0px));
		padding-bottom: calc(48px + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.breadcrumb ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: 14px;
	}

	.breadcrumb li + li::before {
		content: "›";
		margin-right: 4px;
		color: var(--text-muted);
	}

	.breadcrumb a {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		color: var(--accent);
	}

	.breadcrumb [aria-current="page"] {
		color: var(--text-muted);
		overflow-wrap: anywhere;
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

	.hint {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.hint a {
		color: var(--accent);
	}

	.failure {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
	}

	.tools {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tool {
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

	.tool.danger {
		color: var(--danger);
	}

	.tool:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.error {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--danger);
	}

	@media (max-width: 599px) {
		.folder-page {
			padding-top: 8px;
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
