<script lang="ts">
	import AppNavbar from "./AppNavbar.svelte";
</script>

<AppNavbar title="With actions">
	{#snippet actions()}<button type="button">Tool</button>{/snippet}
	{#snippet status()}<p role="alert">Problem</p>{/snippet}
</AppNavbar>
