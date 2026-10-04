<!--
@component
The language switcher of the shared navbar (arc42 ch. 8.18): a native select
with every language the app has a translation for, each in its own name and
marked with its `lang`. Choosing one switches the UI at once; it is
remembered in the browser and, when logged in, stored in the account
(`AccountLanguage`).
-->
<script lang="ts">
	import { accountLanguage, i18n, language, t } from "$lib/i18n";
	import type { LanguageOption } from "$lib/i18n/LocaleRegistry";

	interface Props {
		/** The languages offered; defaults to every bundled translation. */
		languages?: readonly LanguageOption[];
		/** A language was chosen; defaults to `AccountLanguage.choose`. */
		onChoose?: (code: string) => void;
	}

	let { languages = i18n.languages(), onChoose = (code) => void accountLanguage.choose(code) }: Props = $props();
	const uid = $props.id();
</script>

<p class="language-switcher">
	<label class="visually-hidden" for="{uid}-language">{$t.language.label}</label>
	<select
		id="{uid}-language"
		class="select"
		title={$t.language.label}
		value={$language}
		onchange={(event) => onChoose(event.currentTarget.value)}
	>
		{#each languages as option (option.code)}
			<option value={option.code} lang={option.code}>{option.name}</option>
		{/each}
	</select>
</p>

<style>
	.language-switcher {
		margin: 0;
		display: flex;
		flex-shrink: 0;
	}

	.select {
		height: var(--touch-target);
		min-width: var(--touch-target);
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.select:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
