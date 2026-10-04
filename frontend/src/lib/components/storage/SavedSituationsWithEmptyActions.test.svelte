<script lang="ts">
	import type { SessionState } from "$lib/auth/AuthSession";
	import type { SavedListState } from "$lib/storage/SavedSituationList";
	import SavedSituations from "./SavedSituations.svelte";

	interface Props {
		session: SessionState;
		list: SavedListState;
	}

	let { session, list }: Props = $props();
</script>

<SavedSituations {session} {list} emptyMessage="This folder is empty." onOpen={() => {}} onDelete={() => {}} onMove={() => {}} onRetry={() => {}}>
	{#snippet emptyActions()}<button type="button">Start here</button>{/snippet}
</SavedSituations>
