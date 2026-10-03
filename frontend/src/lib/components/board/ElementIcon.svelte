<!--
@component
Decorative icon for an element kind. Hidden from assistive technology: the
surrounding control carries the accessible name.
-->
<script lang="ts">
	import type { ElementType } from "$lib/model/elements/ElementType";

	interface Props {
		type: ElementType;
		size?: number;
	}

	let { type, size = 18 }: Props = $props();
</script>

<svg
	class="element-icon"
	data-type={type}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.9"
	aria-hidden="true"
	focusable="false"
>
	{#if type === "Player"}
		<circle cx="12" cy="8" r="3.2" />
		<path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
	{:else if type === "Ball"}
		<circle cx="12" cy="12" r="8" stroke-width="1.7" />
		<path d="M9 5.5Q13 12 9 18.5M15 5.5Q11 12 15 18.5" stroke-width="1.7" />
	{:else if type === "Pass"}
		<line x1="5" y1="18" x2="17" y2="7" stroke-dasharray="3 3" stroke-linecap="round" />
		<path d="M12 7h5v5" stroke-linecap="round" stroke-linejoin="round" />
	{:else if type === "Run"}
		<path d="M5 18Q9 6 18 8" stroke-linecap="round" />
		<path d="M13 6.5l5 1.2-1.4 4.9" stroke-linecap="round" stroke-linejoin="round" />
	{:else if type === "Shot"}
		<line x1="4" y1="15" x2="14" y2="5" stroke-width="1.6" stroke-linecap="round" />
		<line x1="8" y1="19" x2="18" y2="9" stroke-width="1.6" stroke-linecap="round" />
		<path d="M12 5h6v6" stroke-width="1.6" stroke-linecap="round" />
	{:else if type === "Rectangle"}
		<rect x="4.5" y="6.5" width="15" height="11" rx="1.5" />
	{:else if type === "Triangle"}
		<path d="M12 4.5l8.5 15h-17z" stroke-linejoin="round" />
	{:else if type === "Circle"}
		<circle cx="12" cy="12" r="7.5" />
	{/if}
</svg>
