<script lang="ts">
	import { notifications } from "./Notifications";

	const list = notifications.notifications;
</script>

<div class="stack" role="log" aria-live="polite">
	{#each $list as n (n.id)}
		<button class="toast {n.level}" on:click={() => notifications.dismiss(n.id)}>
			{n.message}
		</button>
	{/each}
</div>

<style>
	.stack {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 340px;
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
