<!--
@component
The account corner of the shared navbar (`AppNavbar`, start page and editor; arc42 ch. 8.8, 8.13):
- logged out: a "Log in" link (a full page navigation to the backend),
  with a short notice if the last login failed ("Login failed.") or the
  account is blocked ("Account blocked.");
- logged in: the user's menu and the "Change display name" dialog;
- no backend (local mode only): a quiet "Local mode" note, no error;
- not known yet: nothing.
-->
<script lang="ts">
	import { authSession, type AuthSession, type LoginNotice } from "$lib/auth/AuthSession";
	import AccountMenu from "./AccountMenu.svelte";
	import DisplayNameDialog from "./DisplayNameDialog.svelte";

	interface Props {
		session?: AuthSession;
		/** Where the login returns to (a local path). */
		returnTo?: string;
		/** The page was opened after a failed login, and why. */
		loginNotice?: LoginNotice | null;
		/** Submits the logout form; replaceable in tests. */
		submitForm?: (form: HTMLFormElement) => void;
	}

	let { session = authSession, returnTo = "/", loginNotice = null, submitForm }: Props = $props();

	const sessionState = $derived(session.state);
	let editingName = $state(false);
</script>

<div class="account-area">
	{#if $sessionState.status === "authenticated"}
		<AccountMenu
			user={$sessionState.user}
			onChangeDisplayName={() => (editingName = true)}
			prepareLogout={() => session.logoutField()}
			{submitForm}
		/>
		<DisplayNameDialog
			open={editingName}
			currentName={$sessionState.user.displayName}
			onSave={(name) => session.changeDisplayName(name)}
			onClose={() => (editingName = false)}
		/>
	{:else if $sessionState.status === "anonymous"}
		{#if loginNotice}
			<p class="account-note" role="status">{loginNotice === "blocked" ? "Account blocked." : "Login failed."}</p>
		{/if}
		<a class="account-login" href={session.loginUrl(returnTo)} data-sveltekit-reload>Log in</a>
	{:else if $sessionState.status === "unavailable"}
		<p class="account-note" title="The server is not reachable. Creating, editing, export and import work as usual.">Local mode</p>
	{/if}
</div>

<style>
	.account-area {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.account-login {
		min-height: var(--touch-target);
		padding: 0 16px;
		display: inline-flex;
		align-items: center;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}

	.account-login:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.account-note {
		margin: 0;
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
