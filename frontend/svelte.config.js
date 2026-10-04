import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Static single-page app (ADR-008): every route is rendered in the
		// browser (`ssr = false` in `src/routes/+layout.ts`); the web server
		// answers every unknown path with the fallback page `index.html`.
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
