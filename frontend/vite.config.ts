import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// The backend (BFF login and REST API) during development: `dotnet run` in
// backend/ listens here. Proxying /api and /auth keeps the session cookie on
// the dev server's origin, like the reverse proxy does in Compose (arc42 ch. 7).
const backend = process.env.TACTICALBOARD_BACKEND ?? 'http://localhost:5080';
const backendProxy = { '/api': backend, '/auth': backend };

export default defineConfig({
	plugins: [sveltekit()],
	server: { proxy: backendProxy },
	preview: { proxy: backendProxy },
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
