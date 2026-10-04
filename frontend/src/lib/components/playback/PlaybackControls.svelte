<!--
@component
The slideshow controls: Play/Pause, Previous, Next and Stop, the shown
frame ("Frame n / N"), the frame duration and the loop toggle. A region
named "Playback" below the board. Play needs at least two frames;
Previous, Next and Stop only work during playback. The keyboard shortcuts
(Space, ←/→, Escape) are handled by the page (`PlaybackShortcuts`); the
buttons mention them in their tooltips.

Becomes compact (icon-only buttons, short status) when narrower than
640 px (CSS container query); the texts stay the accessible names.
-->
<script lang="ts">
	import { FRAME_DURATION_CHOICES_MS } from "$lib/playback/PlaybackSettings";
	import { t } from "$lib/i18n";
	import type { PlaybackStatus } from "$lib/playback/SlideshowPlayer";

	interface Props {
		status: PlaybackStatus;
		/** 1-based number of the frame on the board (the slideshow's during playback, else the active one). */
		frameNumber: number;
		frameCount: number;
		/** Whether there is anything to play (at least two frames). */
		canPlay: boolean;
		frameDurationMs: number;
		loop: boolean;
		onTogglePlay: () => void;
		onPrevious: () => void;
		onNext: () => void;
		onStop: () => void;
		onFrameDurationChange: (frameDurationMs: number) => void;
		onLoopChange: (loop: boolean) => void;
	}

	let {
		status,
		frameNumber,
		frameCount,
		canPlay,
		frameDurationMs,
		loop,
		onTogglePlay,
		onPrevious,
		onNext,
		onStop,
		onFrameDurationChange,
		onLoopChange,
	}: Props = $props();

	const uid = $props.id();
	const active = $derived(status !== "stopped");
	const playing = $derived(status === "playing");
	const playDisabled = $derived(!active && !canPlay);
	const playTitle = $derived(
		playing ? $t.playback.pauseTitle : playDisabled ? $t.playback.playNeedsFrames : $t.playback.playTitle,
	);

	// Guarded as well as `disabled`, so a synthetic click on a disabled button can't trigger it.
	function togglePlay() {
		if (!playDisabled) onTogglePlay();
	}

	function previous() {
		if (active && frameNumber > 1) onPrevious();
	}

	function next() {
		if (active && frameNumber < frameCount) onNext();
	}

	function stop() {
		if (active) onStop();
	}

	function changeDuration(event: Event & { currentTarget: HTMLSelectElement }) {
		onFrameDurationChange(Number(event.currentTarget.value));
	}
</script>

<section class="playback" class:active aria-label={$t.playback.region}>
	<div class="transport" role="group" aria-label={$t.playback.controls}>
		<button
			type="button"
			class="btn primary"
			aria-label={playing ? $t.playback.pause : $t.playback.play}
			title={playTitle}
			disabled={playDisabled}
			onclick={togglePlay}
		>
			{#if playing}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
			{/if}
		</button>
		<button
			type="button"
			class="btn"
			aria-label={$t.playback.previous}
			title={$t.playback.previousTitle}
			disabled={!active || frameNumber <= 1}
			onclick={previous}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="5" y="5" width="2.5" height="14" rx="1" /><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9.5 13.2a1.4 1.4 0 0 1 0-2.4l7.95-5.43A1 1 0 0 1 19 6.2z" /></svg>
		</button>
		<button
			type="button"
			class="btn"
			aria-label={$t.playback.next}
			title={$t.playback.nextTitle}
			disabled={!active || frameNumber >= frameCount}
			onclick={next}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="16.5" y="5" width="2.5" height="14" rx="1" /><path d="M5 6.2v11.6a1 1 0 0 0 1.55.83l7.95-5.43a1.4 1.4 0 0 0 0-2.4L6.55 5.37A1 1 0 0 0 5 6.2z" /></svg>
		</button>
		<button type="button" class="btn" aria-label={$t.playback.stop} title={$t.playback.stopTitle} disabled={!active} onclick={stop}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
		</button>
	</div>

	<p class="status">
		<span class="status-word">{$t.playback.frame}</span>
		{frameNumber} / {frameCount}
	</p>

	<div class="settings">
		<label class="duration" for="{uid}-duration">
			<span class="setting-label">{$t.playback.frameDuration}</span>
			<select id="{uid}-duration" class="select" value={String(frameDurationMs)} onchange={changeDuration}>
				{#each FRAME_DURATION_CHOICES_MS as choice (choice)}
					<option value={String(choice)}>{$t.playback.seconds(choice / 1000)}</option>
				{/each}
			</select>
		</label>
		<button
			type="button"
			class="btn toggle"
			aria-pressed={loop}
			title={loop ? $t.playback.loopOn : $t.playback.loopOff}
			onclick={() => onLoopChange(!loop)}
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>
			<span class="setting-label">{$t.playback.loop}</span>
		</button>
	</div>
</section>

<style>
	.playback {
		container-type: inline-size;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		min-width: 0;
		padding: 6px 16px;
		padding-left: calc(16px + env(safe-area-inset-left, 0px));
		padding-right: calc(16px + env(safe-area-inset-right, 0px));
		background: var(--bg-surface);
		box-shadow: 0 -1px 0 var(--border);
	}

	.transport,
	.settings {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.settings {
		margin-left: auto;
		gap: 8px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: var(--touch-target);
		height: var(--touch-target);
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.btn.primary {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.btn.toggle {
		padding: 0 12px;
	}

	.btn.toggle[aria-pressed="true"] {
		background: var(--accent-soft);
		color: var(--accent);
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn:focus-visible,
	.select:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.status {
		margin: 0;
		min-width: 0;
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.active .status {
		color: var(--accent);
	}

	.duration {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.select {
		height: var(--touch-target);
		min-width: var(--touch-target);
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	/* Narrow (phones, the tablet's narrower workspace): icon-only, short status. */
	@container (max-width: 640px) {
		.status-word,
		.setting-label {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
			border: 0;
		}

		.transport,
		.settings {
			gap: 4px;
		}

		.btn.toggle {
			padding: 0;
		}
	}

	/* Phones: compact bar. */
	@media (max-width: 599px), (max-height: 499px) {
		.playback {
			gap: 4px 8px;
			padding: 4px 8px;
			padding-left: calc(8px + env(safe-area-inset-left, 0px));
			padding-right: calc(8px + env(safe-area-inset-right, 0px));
		}
	}
</style>
