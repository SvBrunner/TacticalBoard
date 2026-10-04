<!--
@component
A folder's page (`/folders/<id>`, deep-linkable; arc42 ch. 8.8, 8.15). The
content (`FolderPage`) is created anew for every folder, so navigating from
one folder's page to another's starts fresh.
-->
<script lang="ts">
	import FolderPage from "./FolderPage.svelte";

	interface Props {
		data: { folderId: string };
	}

	let { data }: Props = $props();
</script>

{#key data.folderId}
	<FolderPage folderId={data.folderId} />
{/key}
