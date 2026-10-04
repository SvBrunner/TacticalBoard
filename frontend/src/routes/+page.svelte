<!--
@component
Start page (overview): start a new situation or import one from a file;
either opens the editor. The header has the account corner (log in / the
user's menu). The "Saved situations" section is where the list of saved
situations and teams goes once there is storage (Phase 2).
-->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { AuthSession } from "$lib/auth/AuthSession";
	import AccountArea from "$lib/components/account/AccountArea.svelte";
	import SituationDialogs from "$lib/components/dialogs/SituationDialogs.svelte";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { SituationFileTransfer } from "$lib/editor/SituationFileTransfer";
	import { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { notifications } from "$lib/debug/Notifications";

	const prompt = new ConfirmationPrompt();
	const workflow = new SituationWorkflow({
		editor: situationEditor,
		files: new SituationFileTransfer(),
		confirm: (request) => prompt.request(request),
		log: notifications,
	});

	const loginFailed = AuthSession.loginFailed(window.location.search);

	let dialogs: SituationDialogs;
	let fileInput: HTMLInputElement;

	function openEditor() {
		void goto("/editor");
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

<main class="start">
	<header class="masthead">
		<div class="badge" aria-hidden="true">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
				<circle cx="12" cy="12" r="9" />
				<path d="M12 3v18M3 12h18" />
			</svg>
		</div>
		<h1 class="app-title">Tactical Board</h1>
		<AccountArea returnTo="/" {loginFailed} />
	</header>

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
		<p class="empty-state">Saved situations will appear here once storage is available.</p>
	</section>
</main>

<SituationDialogs bind:this={dialogs} {workflow} {prompt} onOpened={openEditor} />

<style>
	.start {
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 48px 24px;
		padding-top: calc(48px + env(safe-area-inset-top, 0px));
		padding-left: calc(24px + env(safe-area-inset-left, 0px));
		padding-right: calc(24px + env(safe-area-inset-right, 0px));
		padding-bottom: calc(48px + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.masthead {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
	}

	.badge {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		background: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.app-title {
		margin: 0;
		font-size: 28px;
		font-weight: 700;
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

	.empty-state {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	@media (max-width: 599px) {
		.start {
			padding-top: calc(24px + env(safe-area-inset-top, 0px));
			padding-left: calc(16px + env(safe-area-inset-left, 0px));
			padding-right: calc(16px + env(safe-area-inset-right, 0px));
			gap: 16px;
		}

		.app-title {
			font-size: 22px;
		}

		.panel {
			padding: 16px;
			border-radius: var(--radius-md);
		}
	}
</style>
