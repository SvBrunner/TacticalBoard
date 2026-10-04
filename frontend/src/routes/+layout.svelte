<!--
@component
App shell: global styles, the theme root (dialogs rendered in the top layer
still inherit its colors), the debug notification log, the browser
warning before leaving the app with unsaved changes, the UI language (the
browser's or the remembered one; when logged in the account's, arc42 ch.
8.18), and the first check who is logged in (quietly "unavailable" without
a backend).
-->
<script lang="ts">
	import "./styles.css";
	import { onMount, type Snippet } from "svelte";
	import { authSession } from "$lib/auth/AuthSession";
	import NotificationStack from "$lib/debug/NotificationStack.svelte";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { accountLanguage, i18n } from "$lib/i18n";
	import { UnsavedChangesGuard } from "$lib/editor/UnsavedChangesGuard";
	import { theme } from "$lib/theme";

	let { children }: { children: Snippet } = $props();

	// Before the first render, so no page shows up in the wrong language first.
	i18n.start(navigator.languages?.length ? navigator.languages : [navigator.language]);

	onMount(() => {
		const detachLanguage = accountLanguage.attach();
		void authSession.refresh();
		const detachGuard = new UnsavedChangesGuard(() => situationEditor.isDirty()).attach(window);
		return () => {
			detachLanguage();
			detachGuard();
		};
	});
</script>

<div class="tb-root {$theme}">
	{@render children()}
	<NotificationStack />
</div>

<style>
	.tb-root {
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--bg-app);
		color: var(--text);
	}
</style>
