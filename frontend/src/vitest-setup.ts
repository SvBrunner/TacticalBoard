import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/svelte";
import { I18n } from "$lib/i18n/I18n";
import { i18n } from "$lib/i18n";

// Tests run in English (the fallback), whatever the machine's language; a
// test that switches the language (e.g. to check German) is reset here.
afterEach(() => {
	cleanup();
	i18n.reset();
	try {
		globalThis.localStorage?.removeItem(I18n.STORAGE_KEY);
	} catch {
		// No storage: nothing remembered.
	}
});
