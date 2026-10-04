import { redirect } from "@sveltejs/kit";
import { EditorRoute } from "$lib/editor/EditorRoute";
import { situationEditor } from "$lib/editor/SituationEditor";
import { situationOpener } from "$lib/storage/situationStorage";
import type { PageLoad } from "./$types";

// The board is rendered with Konva, which only works in the browser.
export const ssr = false;

/**
 * The editor needs a situation in memory (created, imported or opened from
 * the start page). Opening `/editor` without one — directly, or after a
 * reload, which loses the in-memory state — restores a saved situation named
 * by `?situation=<id>` from the server; otherwise (a local situation, no
 * login, no server, a deleted situation) it leads back to the start page.
 */
export const load: PageLoad = async ({ url }) => {
	if (situationEditor.isSituationOpen()) {
		return;
	}
	const id = EditorRoute.savedIdIn(url);
	if (id && (await situationOpener.open(id)).status === "opened") {
		return;
	}
	redirect(307, "/");
};
