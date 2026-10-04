<!--
@component
Who created a saved situation and who changed it last, and when (arc42 ch. 1,
8.15), for the details panel. A deleted user is shown as "Deleted user".
-->
<script lang="ts">
	import type { SituationSummary } from "$lib/storage/SituationApi";
	import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";

	interface Props {
		summary: SituationSummary;
	}

	let { summary }: Props = $props();
</script>

<dl class="saved-info" aria-label="Saved on the server">
	<div class="row">
		<dt>Created</dt>
		<dd>
			by {SavedSituationFormat.userName(summary.createdBy)},
			<time datetime={summary.createdAt}>{SavedSituationFormat.dateTime(summary.createdAt)}</time>
		</dd>
	</div>
	<div class="row">
		<dt>Last changed</dt>
		<dd>
			by {SavedSituationFormat.userName(summary.updatedBy)},
			<time datetime={summary.updatedAt}>{SavedSituationFormat.dateTime(summary.updatedAt)}</time>
		</dd>
	</div>
</dl>

<style>
	.saved-info {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		line-height: 1.4;
	}

	.row {
		display: flex;
		flex-direction: column;
	}

	dt {
		font-weight: 600;
		color: var(--text-muted);
	}

	dd {
		margin: 0;
		color: var(--text);
	}
</style>
