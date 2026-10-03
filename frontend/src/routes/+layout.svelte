<!--
@component
App shell: global styles, the theme root (dialogs rendered in the top layer
still inherit its colors), the debug notification log, and the browser
warning before leaving the app with unsaved changes.
-->
<script lang="ts">
	import "./styles.css";
	import { onMount, type Snippet } from "svelte";
	import NotificationStack from "$lib/debug/NotificationStack.svelte";
	import { situationEditor } from "$lib/editor/SituationEditor";
	import { UnsavedChangesGuard } from "$lib/editor/UnsavedChangesGuard";
	import { theme } from "$lib/theme";

	let { children }: { children: Snippet } = $props();

	onMount(() => new UnsavedChangesGuard(() => situationEditor.isDirty()).attach(window));
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
