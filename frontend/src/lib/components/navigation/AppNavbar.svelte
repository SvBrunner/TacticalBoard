<!--
@component
The app's navigation bar, shared by the start page and the editor: the
banner with the app badge (a link to the start page, in the "Main"
navigation), the page title (the page's h1), the page's own `actions` (e.g.
the editor's tools), and the account corner (in the "Account" navigation:
"Log in", the user's menu, or "Local mode"; arc42 ch. 8.8, 8.13). `status`
is rendered at the end (e.g. save feedback hanging below the bar).

On narrow phones the bar wraps: badge, title and account in the first row,
the page's actions in a second row, so every control keeps its 44 px target.
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { LoginNotice } from "$lib/auth/AuthSession";
	import AccountArea from "$lib/components/account/AccountArea.svelte";

	interface Props {
		title: string;
		/** The badge was activated (a plain click); without it the badge is an ordinary link. */
		onHome?: () => void;
		/** The start page itself: the badge is marked as the current page. */
		home?: boolean;
		/** Where a login started here returns to (a local path). */
		loginReturnTo?: string;
		/** The page was opened after a failed login, and why. */
		loginNotice?: LoginNotice | null;
		actions?: Snippet;
		status?: Snippet;
	}

	let { title, onHome, home = false, loginReturnTo = "/", loginNotice = null, actions, status }: Props = $props();

	// A real link (works without the handler, e.g. opened in a new tab); a
	// plain activation goes through `onHome` (e.g. "Discard changes?").
	function handleHome(event: MouseEvent) {
		if (!onHome || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		onHome();
	}
</script>

<header class="navbar" class:with-actions={actions !== undefined}>
	<nav class="nav-main" aria-label="Main">
		<a class="badge" href="/" aria-label="Start page" title="Start page" aria-current={home ? "page" : undefined} onclick={handleHome}>
			<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<circle cx="12" cy="12" r="9" />
				<path d="M12 3v18M3 12h18" />
			</svg>
		</a>
	</nav>

	<h1 class="title">{title}</h1>

	{#if actions}
		<div class="actions">
			{@render actions()}
		</div>
	{/if}

	<nav class="nav-account" aria-label="Account">
		<AccountArea returnTo={loginReturnTo} {loginNotice} />
	</nav>

	{@render status?.()}
</header>

<style>
	.navbar {
		min-height: 64px;
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		column-gap: 16px;
		padding: 10px 20px;
		padding-top: calc(10px + env(safe-area-inset-top, 0px));
		padding-left: calc(20px + env(safe-area-inset-left, 0px));
		padding-right: calc(20px + env(safe-area-inset-right, 0px));
		background: var(--bg-surface);
		position: relative;
		z-index: 2;
		box-sizing: border-box;
		box-shadow:
			0 1px 0 var(--border),
			0 6px 16px -10px oklch(20% 0.02 260 / 0.35);
	}

	.nav-main {
		display: flex;
		flex-shrink: 0;
	}

	/* The visible badge stays 34 px; the link's hit area is the 44 px touch target around it. */
	.badge {
		width: var(--touch-target);
		height: var(--touch-target);
		margin: -5px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: var(--accent);
		background-clip: content-box;
		padding: 5px;
		box-sizing: border-box;
	}

	.badge:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.nav-account {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		min-width: 0;
	}

	@media (max-width: 1023px) {
		.navbar {
			column-gap: 8px;
			padding-left: calc(16px + env(safe-area-inset-left, 0px));
			padding-right: calc(16px + env(safe-area-inset-right, 0px));
		}
	}

	/* Phones: a compact bar. */
	@media (max-width: 599px), (max-height: 499px) {
		.navbar {
			min-height: 48px;
			padding-top: calc(2px + env(safe-area-inset-top, 0px));
			padding-bottom: 2px;
			padding-left: calc(8px + env(safe-area-inset-left, 0px));
			padding-right: calc(8px + env(safe-area-inset-right, 0px));
		}

		.badge {
			padding: 8px;
			margin: 0 -2px;
		}

		.title {
			font-size: 14px;
		}
	}

	/* Narrow phones in portrait: the page's actions get a second row. */
	@media (max-width: 599px) {
		.with-actions .actions {
			order: 1;
			flex-basis: 100%;
			justify-content: flex-end;
			padding: 2px 0;
			border-top: 1px solid var(--border);
		}
	}
</style>
