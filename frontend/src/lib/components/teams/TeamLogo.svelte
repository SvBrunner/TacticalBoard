<!--
@component
A team's logo (arc42 ch. 8.17), or — without one — a neutral placeholder
with the first letter of its name. In lists it is decorative (the name is
written next to it, `alt` empty); on the team page it gets a text
alternative.
-->
<script lang="ts">
	interface Props {
		logoUrl: string | null;
		name: string;
		/** Edge length in CSS px (logos are at most 256 × 256 px and keep their aspect ratio inside). */
		size?: number;
		/** The image's text alternative; empty (the default) marks it as decorative. */
		alt?: string;
	}

	let { logoUrl, name, size = 40, alt = "" }: Props = $props();

	const initial = $derived(Array.from(name.trim())[0]?.toUpperCase() ?? "?");
</script>

{#if logoUrl}
	<img class="logo" src={logoUrl} {alt} width={size} height={size} style:--size="{size}px" loading="lazy" decoding="async" />
{:else}
	<span class="logo placeholder" style:--size="{size}px" aria-hidden="true">{initial}</span>
{/if}

<style>
	.logo {
		flex: none;
		width: var(--size);
		height: var(--size);
		border-radius: var(--radius-sm);
		object-fit: contain;
		background: var(--bg-surface);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.placeholder {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-app);
		color: var(--text-muted);
		font-size: calc(var(--size) * 0.45);
		font-weight: 700;
		line-height: 1;
	}
</style>
