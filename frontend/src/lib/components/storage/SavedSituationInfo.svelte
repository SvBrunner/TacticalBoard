<!--
@component
Who created a saved situation and who changed it last, and when (arc42 ch. 1,
8.15), for the details panel. A deleted user is shown as "Deleted user".
-->
<script lang="ts">
	import { language, t } from "$lib/i18n";
	import type { SituationSummary } from "$lib/storage/SituationApi";
	import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";

	interface Props {
		summary: SituationSummary;
	}

	let { summary }: Props = $props();
</script>

<dl class="saved-info" aria-label={$t.saved.info}>
	<div class="row">
		<dt>{$t.saved.created}</dt>
		<dd>
			{$t.saved.by(SavedSituationFormat.userName(summary.createdBy, $t))}
			<time datetime={summary.createdAt}>{SavedSituationFormat.dateTime(summary.createdAt, $language)}</time>
		</dd>
	</div>
	<div class="row">
		<dt>{$t.saved.lastChanged}</dt>
		<dd>
			{$t.saved.by(SavedSituationFormat.userName(summary.updatedBy, $t))}
			<time datetime={summary.updatedAt}>{SavedSituationFormat.dateTime(summary.updatedAt, $language)}</time>
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
