<!--
@component
A team's situations and folders on its page (members only; arc42 ch. 8.1,
8.8, 8.15): the same as the personal area on the start page, in the team's
area. Admins and Editors (`canWrite`) get "Start in this team" (New situation
/ Import, whose first save goes to the team's top level), "New folder", and
Move / Delete per situation; Readers see the folders (links to their pages,
with their situation counts) and the situations at the top level and can
open them (read-only in the editor), with a hint why nothing else is
offered. The page re-creates it when the user's role changes.
-->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { authSession } from "$lib/auth/AuthSession";
	import PromptDialog from "$lib/components/dialogs/PromptDialog.svelte";
	import FolderNameDialog from "$lib/components/storage/FolderNameDialog.svelte";
	import MoveSituationDialog from "$lib/components/storage/MoveSituationDialog.svelte";
	import SavedFolders from "$lib/components/storage/SavedFolders.svelte";
	import SavedSituations from "$lib/components/storage/SavedSituations.svelte";
	import StartActions from "$lib/components/storage/StartActions.svelte";
	import { notifications } from "$lib/debug/Notifications";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { t } from "$lib/i18n";
	import { teamArea } from "$lib/storage/Area";
	import { FolderList } from "$lib/storage/FolderList";
	import { SavedSituationActions } from "$lib/storage/SavedSituationActions";
	import { SavedSituationList } from "$lib/storage/SavedSituationList";
	import { teamTopLevel } from "$lib/storage/SaveTarget";
	import type { SituationSummary } from "$lib/storage/SituationApi";
	import { situationLink } from "$lib/storage/SituationLink";
	import { folderApi, situationApi, situationOpener } from "$lib/storage/situationStorage";

	interface Props {
		/** The team's id (its area); fixed for the component's life. */
		teamId: string;
		/** Whether the user may change the team's content (Admins and Editors). */
		canWrite: boolean;
	}

	let props: Props = $props();

	// svelte-ignore state_referenced_locally
	const { teamId, canWrite } = props;
	const uid = $props.id();
	const area = teamArea(teamId);
	const target = teamTopLevel(teamId);
	const prompt = new ConfirmationPrompt();
	const workflow = new SituationWorkflow({
		editor: situationEditor,
		files: new SituationFileTransfer(),
		link: situationLink,
		confirm: (request) => prompt.request(request),
		isLoggedIn: () => authSession.current().status === "authenticated",
		log: notifications,
	});
	const sessionState = authSession.state;
	const refreshSession = () => void authSession.refresh();
	const savedList = new SavedSituationList({
		api: situationApi,
		place: target,
		link: situationLink,
		onSessionEnded: refreshSession,
		log: notifications,
	});
	const savedState = savedList.state;
	const folders = new FolderList({ api: folderApi, area: () => area, onSessionEnded: refreshSession, log: notifications });
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
	const folderItems = $derived($folderState.status === "loaded" ? $folderState.folders : []);

	$effect(() => {
		void savedList.load();
		void folders.load();
	});

	function openEditor() {
		void goto("/editor");
	}

	function move(situation: SituationSummary, folderId: string | null) {
		moving = null;
		void actions.move(situation, folderId).then(() => folders.load());
	}

	async function deleteSituation(situation: SituationSummary) {
		if (await actions.delete(situation)) {
			void folders.load();
		}
	}
</script>

{#if canWrite}
	<section class="panel" aria-labelledby="{uid}-start">
		<h2 id="{uid}-start" class="panel-title">{$t.teamContent.startHere}</h2>
		<StartActions {workflow} {prompt} {target} onOpened={openEditor} />
	</section>
{/if}

<section class="panel" aria-labelledby="{uid}-content">
	<h2 id="{uid}-content" class="panel-title">{$t.teamContent.heading}</h2>
	{#if !canWrite}
		<p class="hint">{$t.teamContent.readOnly}</p>
	{/if}
	{#if $actionState.error}
		<p class="error" role="alert">{$actionState.error($t)}</p>
	{/if}
	<section class="part" aria-labelledby="{uid}-folders">
		<div class="part-head">
			<h3 id="{uid}-folders" class="part-title">{$t.teamContent.folders}</h3>
			{#if canWrite}
				<button type="button" class="tool" onclick={() => (creatingFolder = true)}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
						<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
						<path d="M12 11v5M9.5 13.5h5" />
					</svg>
					{$t.teamContent.newFolder}
				</button>
			{/if}
		</div>
		<SavedFolders list={$folderState} onRetry={() => void folders.load()} />
	</section>
	<section class="part" aria-labelledby="{uid}-situations">
		<h3 id="{uid}-situations" class="part-title">{$t.teamContent.situations}</h3>
		<SavedSituations
			session={$sessionState}
			list={$savedState}
			busy={$actionState.opening}
			canChange={canWrite}
			emptyMessage={folderItems.length > 0 ? $t.teamContent.noTopLevelSituations : $t.teamContent.empty}
			onOpen={(situation) => void actions.open(situation)}
			onDelete={(situation) => void deleteSituation(situation)}
			onMove={(situation) => (moving = situation)}
			onRetry={() => void savedList.load()}
		/>
	</section>
</section>

{#if canWrite}
	<FolderNameDialog
		open={creatingFolder}
		title={$t.folders.newHeading}
		submitLabel={$t.common.create}
		onSubmit={(name) => folders.create(name)}
		onClose={() => (creatingFolder = false)}
	/>
	<MoveSituationDialog situation={moving} folders={folderItems} onMove={move} onCancel={() => (moving = null)} />
{:else}
	<!-- Without StartActions (which shows them otherwise): "Discard changes?" before opening a situation. -->
	<PromptDialog {prompt} />
{/if}

<style>
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

	.tool:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.hint {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.error {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--danger);
	}

	@media (max-width: 599px) {
		.panel {
			padding: 16px;
			border-radius: var(--radius-md);
		}
	}
</style>
