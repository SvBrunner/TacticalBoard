/**
 * The editor's URLs: `/editor` for a situation that only exists in memory,
 * `/editor?situation=<id>` for a saved (server) situation, so a reload can
 * restore it from the server.
 */
export class EditorRoute {
	static readonly PATH = "/editor";
	static readonly SITUATION_PARAMETER = "situation";

	/** The editor's URL for the saved situation `id`. */
	static forSaved(id: string): string {
		return `${EditorRoute.PATH}?${EditorRoute.SITUATION_PARAMETER}=${encodeURIComponent(id)}`;
	}

	/** The saved situation named in `url`, if any. */
	static savedIdIn(url: URL): string | null {
		return url.searchParams.get(EditorRoute.SITUATION_PARAMETER) || null;
	}
}
