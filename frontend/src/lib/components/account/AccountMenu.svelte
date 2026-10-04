<!--
@component
The logged-in user's menu: a disclosure button with the display name, and
below it "Change display name" and "Log out". On phones the button shows
only the user icon; the display name stays its accessible name. Log out is a real form POST to
`/auth/logout` (a full page navigation, so the backend can continue with the
identity provider's logout); its antiforgery field is fetched right before
submitting. The menu closes after a choice, with Escape (focus back on the
button), or when focus or a press goes elsewhere.
-->
<script lang="ts">
	import { AuthSession, type CurrentUser, type FormField } from "$lib/auth/AuthSession";
	import { t } from "$lib/i18n";

	interface Props {
		user: CurrentUser;
		/** "Change display name" was chosen. */
		onChangeDisplayName: () => void;
		/** The antiforgery field for the logout form. */
		prepareLogout: () => Promise<FormField>;
		/** Submits the logout form (a navigation); replaceable in tests. */
		submitForm?: (form: HTMLFormElement) => void;
	}

	let { user, onChangeDisplayName, prepareLogout, submitForm = (form) => form.submit() }: Props = $props();

	const uid = $props.id();
	let menu: HTMLElement;
	let toggle: HTMLButtonElement;
	let tokenField: HTMLInputElement;
	let open = $state(false);
	let loggingOut = $state(false);
	let logoutFailed = $state(false);

	function close(focusToggle: boolean) {
		open = false;
		if (focusToggle) {
			toggle.focus();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && open) {
			event.preventDefault();
			event.stopPropagation();
			close(true);
		}
	}

	function handleFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && menu.contains(next)) {
			return;
		}
		if (next !== null) {
			open = false;
		}
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (open && !(event.target instanceof Node && menu.contains(event.target))) {
			open = false;
		}
	}

	function chooseChangeDisplayName() {
		close(true);
		onChangeDisplayName();
	}

	async function handleLogout(event: SubmitEvent) {
		event.preventDefault();
		if (loggingOut) {
			return;
		}
		const form = event.currentTarget as HTMLFormElement;
		loggingOut = true;
		logoutFailed = false;
		try {
			const field = await prepareLogout();
			tokenField.name = field.name;
			tokenField.value = field.value;
			submitForm(form);
		} catch {
			logoutFailed = true;
			loggingOut = false;
		}
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="account-menu" bind:this={menu} onfocusout={handleFocusOut}>
	<button
		bind:this={toggle}
		type="button"
		class="account-toggle"
		aria-expanded={open}
		aria-controls="{uid}-account-options"
		onclick={() => (open = !open)}
		onkeydown={handleKeydown}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
			<circle cx="12" cy="8" r="4" />
			<path d="M4 21a8 8 0 0 1 16 0" />
		</svg>
		<span class="name">{user.displayName}</span>
		<svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>
	<ul id="{uid}-account-options" class="account-options" aria-label={$t.account.menu} hidden={!open}>
		<li>
			<button type="button" class="account-option" onclick={chooseChangeDisplayName} onkeydown={handleKeydown}>{$t.account.changeDisplayName}</button>
		</li>
		<li>
			<form method="post" action={AuthSession.LOGOUT_PATH} onsubmit={handleLogout}>
				<input bind:this={tokenField} type="hidden" />
				<button type="submit" class="account-option" disabled={loggingOut} onkeydown={handleKeydown}>{$t.account.logOut}</button>
			</form>
		</li>
	</ul>
	{#if logoutFailed}
		<p class="account-error" role="alert">{$t.account.logoutFailed}</p>
	{/if}
</div>

<style>
	.account-menu {
		position: relative;
	}

	.account-toggle {
		max-width: min(240px, 50vw);
		min-height: var(--touch-target);
		padding: 0 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.account-toggle svg {
		flex-shrink: 0;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account-toggle[aria-expanded="true"] .chevron {
		transform: rotate(180deg);
	}

	.account-toggle:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.account-options {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 3;
		min-width: 220px;
		margin: 0;
		padding: 6px;
		list-style: none;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow);
	}

	.account-options form {
		margin: 0;
	}

	.account-option {
		width: 100%;
		min-height: var(--touch-target);
		padding: 0 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 14px;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	.account-option:hover,
	.account-option:focus-visible {
		background: var(--bg-app);
	}

	.account-option:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.account-option:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	/* Phones: icon only, so the shared navbar fits (the name stays the accessible name). */
	@media (max-width: 599px), (max-height: 499px) {
		.account-toggle {
			width: var(--touch-target);
			padding: 0;
			justify-content: center;
		}

		.name {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		.chevron {
			display: none;
		}
	}

	.account-error {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		margin: 0;
		padding: 8px 12px;
		width: max-content;
		max-width: min(280px, 80vw);
		font-size: 13px;
		color: var(--danger);
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
</style>
