<!--
@component
Start page (overview): start a new situation or import one from a file;
either opens the editor. On top the shared app navbar (`AppNavbar`) with the
account corner (log in / the user's menu). "Saved situations" lists the personal area's saved situations
when logged in (open, delete); otherwise it explains why there are none.
Teams follow later (Phase 2).
-->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { AuthSession, authSession } from "$lib/auth/AuthSession";
	import AppNavbar from "$lib/components/navigation/AppNavbar.svelte";
	import SituationDialogs from "$lib/components/dialogs/SituationDialogs.svelte";
	import SavedSituations from "$lib/components/storage/SavedSituations.svelte";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { EditorRoute } from "$lib/editor/EditorRoute";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { notifications } from "$lib/debug/Notifications";
	import { SavedSituationList } from "$lib/storage/SavedSituationList";
	import type { SituationSummary } from "$lib/storage/SituationApi";
	import { situationLink } from "$lib/storage/SituationLink";
	import { situationApi, situationOpener } from "$lib/storage/situationStorage";

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
	const savedList = new SavedSituationList({
		api: situationApi,
		onSessionEnded: () => void authSession.refresh(),
		log: notifications,
	});
	const savedState = savedList.state;
	let opening = $state(false);
	let openError: string | null = $state(null);

	// The list belongs to the logged-in user: (re)load it whenever the login state says so.
	$effect(() => {
		if ($sessionState.status === "authenticated") {
			void savedList.load();
		}
	});

	let dialogs: SituationDialogs;
	let fileInput: HTMLInputElement;

	function openEditor() {
		void goto("/editor");
	}

	/** Opens a saved situation in the editor ("Discard changes?" first if needed, as for an import). */
	async function openSaved(situation: SituationSummary) {
		opening = true;
		openError = null;
		try {
			const outcome = await situationOpener.open(situation.id, () => workflow.confirmDiscardIfDirty());
			if (outcome.status === "opened") {
				await goto(EditorRoute.forSaved(situation.id));
			} else if (outcome.status === "failed") {
				openError = `"${situation.title}" couldn't be opened. ${outcome.message}`;
				void savedList.load();
			}
		} finally {
			opening = false;
		}
	}

	async function deleteSaved(situation: SituationSummary) {
		openError = null;
		const confirmed = await prompt.request({
			title: "Delete situation?",
			message: `“${situation.title}” will be deleted.`,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
		});
		if (confirmed) {
			await savedList.delete(situation);
		}
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (file) {
			void dialogs.importFile(file);
		}
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
		<ul class="actions">
			<li>
				<button type="button" class="action primary" onclick={() => dialogs.startNew()}>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
						<path d="M12 5v14M5 12h14" />
					</svg>
					New situation
				</button>
			</li>
			<li>
				<button type="button" class="action" onclick={() => fileInput.click()}>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
						<path d="M12 15V3M7 8l5-5 5 5" />
						<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
					</svg>
					Import
				</button>
				<input
					bind:this={fileInput}
					type="file"
					accept=".json"
					class="hidden-input"
					onchange={handleFileChange}
				/>
			</li>
		</ul>
	</section>

	<section class="panel" aria-labelledby="saved-heading">
		<h2 id="saved-heading" class="panel-title">Saved situations</h2>
		{#if openError}
			<p class="open-error" role="alert">{openError}</p>
		{/if}
		<SavedSituations
			session={$sessionState}
			list={$savedState}
			busy={opening}
			onOpen={openSaved}
			onDelete={deleteSaved}
			onRetry={() => void savedList.load()}
		/>
	</section>
</main>

<SituationDialogs bind:this={dialogs} {workflow} {prompt} onOpened={openEditor} />

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

	.actions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.action {
		width: 100%;
		min-height: 72px;
		padding: 0 20px;
		display: flex;
		align-items: center;
		gap: 12px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font-size: 16px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.action.primary {
		background: var(--accent);
		color: var(--accent-contrast);
		box-shadow: none;
	}

	.action:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.hidden-input {
		display: none;
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
