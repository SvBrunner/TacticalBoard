<!--
@component
Modal "Export animated GIF" dialog around an `AnimationExport`: choose the
resolution (default Medium), see the frame count and the frame duration
(the playback setting, shown read-only), then Create GIF. While the GIF is
created a progress bar and Cancel are shown; afterwards Download and, where
the device can share files, Share. Escape or Close closes it (and cancels a
running export). The owner opens it through `open` after `flow.begin()`.
-->
<script lang="ts">
	import { tick } from "svelte";
	import { modalDialog } from "$lib/actions/modalDialog";
	import type { AnimationExport } from "$lib/export/AnimationExport.svelte";
	import { ExportResolution } from "$lib/export/ExportResolution";
	import { t } from "$lib/i18n";
	import type { Messages } from "$lib/i18n/Messages";

	interface Props {
		open: boolean;
		flow: AnimationExport;
		/** The dialog was closed (Close, Escape); the export is already cancelled. */
		onClose: () => void;
	}

	let { open, flow, onClose }: Props = $props();

	const uid = $props.id();
	let createButton: HTMLButtonElement | undefined = $state();
	let cancelButton: HTMLButtonElement | undefined = $state();
	let downloadButton: HTMLButtonElement | undefined = $state();

	const phase = $derived(flow.phase);
	const busy = $derived(phase.kind === "rendering");

	// The button that was pressed disappears with each step: keep focus in the dialog.
	$effect(() => {
		const kind = phase.kind;
		if (!open) {
			return;
		}
		void tick().then(() => {
			const target = kind === "rendering" ? cancelButton : kind === "ready" ? downloadButton : null;
			target?.focus();
		});
	});

	function close() {
		flow.close();
		onClose();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void flow.create();
	}

	function sizeLabel(resolution: ExportResolution, m: Messages): string {
		const size = flow.sizeAt(resolution);
		return size ? m.exportGif.size(size.width, size.height) : "";
	}

	function fileSize(bytes: number, m: Messages): string {
		return bytes >= 1024 * 1024
			? m.exportGif.megabytes(bytes / (1024 * 1024))
			: m.exportGif.kilobytes(Math.max(1, Math.round(bytes / 1024)));
	}
</script>

<dialog
	class="modal-dialog"
	aria-labelledby="{uid}-title"
	aria-busy={busy}
	use:modalDialog={{ open, onCancel: close, initialFocus: () => createButton }}
>
	<form method="dialog" class="modal-form" onsubmit={handleSubmit}>
		<h2 id="{uid}-title" class="modal-title">{$t.exportGif.heading}</h2>

		<fieldset class="modal-fieldset" disabled={busy}>
			<legend class="modal-label">{$t.exportGif.resolution}</legend>
			<ul class="choices">
				{#each ExportResolution.ALL as resolution (resolution.id)}
					<li>
						<label class="choice">
							<input
								type="radio"
								name="resolution"
								value={resolution.id}
								checked={flow.resolution === resolution}
								onchange={() => flow.chooseResolution(resolution)}
							/>
							<span class="choice-text">
								<span>{$t.exportGif.resolutions[resolution.id]}</span>
								<span class="choice-detail">{sizeLabel(resolution, $t)}</span>
							</span>
						</label>
					</li>
				{/each}
			</ul>
		</fieldset>

		<dl class="facts">
			<div>
				<dt>{$t.exportGif.frames}</dt>
				<dd>{flow.frameCount}</dd>
			</div>
			<div>
				<dt>{$t.exportGif.frameDuration}</dt>
				<dd>
					{flow.frameDurationMs === null ? "" : $t.playback.seconds(flow.frameDurationMs / 1000)}
					<span class="hint">{$t.exportGif.playbackSetting}</span>
				</dd>
			</div>
		</dl>

		{#if phase.kind === "rendering"}
			<p class="modal-field">
				<label class="modal-label" for="{uid}-progress">
					{$t.exportGif.progress(Math.min(phase.done + 1, phase.total), phase.total)}
				</label>
				<progress id="{uid}-progress" class="progress" max={phase.total} value={phase.done}></progress>
			</p>
		{:else if phase.kind === "ready"}
			<p class="modal-text" role="status">
				<strong class="file-name">{phase.file.name}</strong>
				{$t.exportGif.ready(fileSize(phase.file.size, $t))}
			</p>
			{#if flow.shareError}
				<p class="modal-text error" role="alert">{$t.exportGif.shareFailed(flow.shareError)}</p>
			{/if}
		{:else if phase.kind === "failed"}
			<p class="modal-text error" role="alert">{$t.exportGif.failed(phase.message)}</p>
		{/if}

		<div class="modal-actions">
			{#if phase.kind === "rendering"}
				<button bind:this={cancelButton} type="button" class="modal-btn secondary" onclick={() => flow.cancel()}>{$t.common.cancel}</button>
			{:else if phase.kind === "ready"}
				<button type="button" class="modal-btn secondary" onclick={close}>{$t.common.close}</button>
				{#if flow.canShare}
					<button type="button" class="modal-btn secondary" onclick={() => flow.share()}>{$t.exportGif.share}</button>
				{/if}
				<button bind:this={downloadButton} type="button" class="modal-btn primary" onclick={() => flow.download()}>{$t.exportGif.download}</button>
			{:else}
				<button type="button" class="modal-btn secondary" onclick={close}>{$t.common.close}</button>
				<button bind:this={createButton} type="submit" class="modal-btn primary">
					{phase.kind === "failed" ? $t.common.tryAgain : $t.exportGif.create}
				</button>
			{/if}
		</div>
	</form>
</dialog>

<style>
	.choices {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 8px;
	}

	.choice {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--touch-target);
		padding: 6px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 14px;
		box-sizing: border-box;
	}

	.choice:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	fieldset:disabled .choice {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.choice input {
		width: 18px;
		height: 18px;
		margin: 0;
		flex-shrink: 0;
		accent-color: var(--accent);
	}

	.choice-text {
		display: flex;
		flex-direction: column;
	}

	.choice-detail,
	.hint {
		font-size: 12px;
		color: var(--text-muted);
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 24px;
		margin: 0;
		font-size: 14px;
	}

	.facts dt {
		font-size: 13px;
		font-weight: 600;
	}

	.facts dd {
		margin: 2px 0 0;
	}

	.progress {
		width: 100%;
		height: 12px;
		accent-color: var(--accent);
	}

	.file-name {
		color: var(--text);
		overflow-wrap: anywhere;
	}

	.error {
		color: var(--danger);
	}
</style>
