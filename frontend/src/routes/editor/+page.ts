import { redirect } from "@sveltejs/kit";
import { situationEditor } from "$lib/editor/SituationEditor";
import type { PageLoad } from "./$types";

// The board is rendered with Konva, which only works in the browser.
export const ssr = false;

/**
 * The editor needs a situation, which only exists in memory (created or
 * imported from the start page). Opening `/editor` directly — or reloading
 * it, which loses the in-memory state — leads back to the start page.
 */
export const load: PageLoad = () => {
	if (!situationEditor.isSituationOpen()) {
		redirect(307, "/");
	}
};
