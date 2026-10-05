<!--
@component
The logo part of a team's page for its Admins (arc42 ch. 8.17): "Upload
logo" (or "Replace logo") opens the file picker; a PNG, JPEG or WebP of at
most 5 MB is uploaded at once, anything else is refused with the reason.
"Remove logo" asks first (through `remove`). Progress and the outcome are
announced; failures are shown as an alert.
-->
<script lang="ts">
	import { t } from "$lib/i18n";
	import type { Translatable } from "$lib/i18n/Messages";
	import { LogoChoice } from "$lib/teams/LogoChoice.svelte";
	import type { Team } from "$lib/teams/TeamApi";
	import type { TeamChange } from "$lib/teams/TeamMessages";

	interface Props {
		team: Team;
		/** Uploads the file as the team's logo. */
		upload: (file: File) => Promise<TeamChange<Team>>;
		/** Removes the logo after asking; `null` when the user cancelled. */
		remove: () => Promise<TeamChange<Team> | null>;
	}

	let { team, upload, remove }: Props = $props();

	let fileInput: HTMLInputElement;
	let busy = $state(false);
	let status: Translatable | null = $state(null);
	let error: Translatable | null = $state(null);

	async function run(action: () => Promise<TeamChange<Team> | null>, progress: Translatable | null, done: Translatable) {
		busy = true;
		error = null;
		status = progress;
		const outcome = await action();
		busy = false;
		status = outcome?.ok ? done : null;
		if (outcome && !outcome.ok) {
			error = outcome.message;
		}
	}

	function handleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = "";
		if (!file) {
			return;
		}
		const problem = LogoChoice.problemOf(file);
		if (problem) {
			status = null;
			error = problem;
			return;
		}
		void run(() => upload(file), (m) => m.teamPage.uploading, (m) => m.teamPage.logoSaved);
	}
</script>

<div class="logo-editor">
	<ul class="tools">
		<li>
			<button type="button" class="tool" disabled={busy} onclick={() => fileInput.click()}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
					<path d="M12 15V3M7 8l5-5 5 5" />
					<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
				</svg>
				{team.logoUrl ? $t.teamPage.replaceLogo : $t.teamPage.uploadLogo}
			</button>
		</li>
		{#if team.logoUrl}
			<li>
				<button type="button" class="tool danger" disabled={busy} onclick={() => void run(remove, null, (m) => m.teamPage.logoRemoved)}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
						<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
					</svg>
					{$t.teamPage.removeLogo}
				</button>
			</li>
		{/if}
	</ul>
	<input bind:this={fileInput} type="file" accept={LogoChoice.ACCEPT} class="hidden-input" tabindex="-1" aria-hidden="true" onchange={handleChange} />
	<p class="status" role="status">{status?.($t) ?? ""}</p>
	{#if error}
		<p class="error" role="alert">{error($t)}</p>
	{/if}
</div>

<style>
	.logo-editor {
		display: flex;
		flex-direction: column;
		gap: 8px;
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

	.tool:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.tool:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.status {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted);
	}

	.error {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--danger);
	}

	.hidden-input {
		display: none;
	}
</style>
