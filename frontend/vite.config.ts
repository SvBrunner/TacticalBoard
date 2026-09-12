import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/vitest-setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	// Vitest runs in Node, which would otherwise make Vite resolve Svelte's
	// server-side (SSR) build; components need the browser build to mount
	// in jsdom the same way they do in a real browser.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined
});
