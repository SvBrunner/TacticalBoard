<!--
@component
Debug log of notifications as dismissible toasts. Rendered only in dev mode
(`import.meta.env.DEV`); production builds show nothing.
-->
<script lang="ts">
	import { notifications } from "./Notifications";

	interface Props {
		/** Whether the stack is shown at all; defaults to dev mode. */
		enabled?: boolean;
	}

	let { enabled = import.meta.env.DEV }: Props = $props();

	const list = notifications.notifications;
</script>

{#if enabled}
	<div class="stack" role="log" aria-live="polite">
		{#each $list as n (n.id)}
			<button type="button" class="toast {n.level}" onclick={() => notifications.dismiss(n.id)}>
				{n.message}
			</button>
		{/each}
	</div>
{/if}

<style>
	.stack {
		position: fixed;
		/* Below the header, so it never covers the header's buttons. */
		top: calc(72px + env(safe-area-inset-top, 0px));
		right: calc(16px + env(safe-area-inset-right, 0px));
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: min(340px, calc(100vw - 32px));
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		text-align: left;
		font-family: inherit;
		font-size: 12px;
		line-height: 1.4;
		padding: 10px 12px;
		border-radius: var(--radius-sm, 8px);
		border: 1px solid var(--border, #ccc);
		background: var(--bg-surface, #fff);
		color: var(--text, #111);
		box-shadow: var(--shadow, 0 8px 24px -8px rgba(0, 0, 0, 0.3));
		cursor: pointer;
		word-break: break-word;
		animation: pop-in 150ms ease-out;
	}

	.toast.warn {
		border-color: var(--opponent, #c66);
		color: var(--opponent, #c66);
	}

	.toast.error {
		border-color: var(--danger, #c33);
		color: var(--danger, #c33);
	}

	@media (max-width: 599px), (max-height: 499px) {
		.stack {
			top: calc(56px + env(safe-area-inset-top, 0px));
			right: calc(8px + env(safe-area-inset-right, 0px));
			max-width: min(280px, calc(100vw - 16px));
		}

		.toast {
			font-size: 11px;
			padding: 6px 8px;
		}
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
