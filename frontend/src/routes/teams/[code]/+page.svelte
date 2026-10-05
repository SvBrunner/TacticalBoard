<!--
@component
A team's page (`/teams/<CODE>`, deep-linkable; arc42 ch. 8.8, 8.17). The
content (`TeamPage`) is created anew for every team, so going from one
team's page to another's starts fresh.
-->
<script lang="ts">
	import TeamPage from "./TeamPage.svelte";

	interface Props {
		data: { code: string };
	}

	let { data }: Props = $props();
</script>

{#key data.code}
	<TeamPage code={data.code} />
{/key}
