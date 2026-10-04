/**
 * The URL of a folder's page: `/folders/<id>` (deep-linkable; arc42 ch. 8.8).
 * The start page lists the folders of the personal area with links to it.
 */
export class FolderRoute {
	static readonly PREFIX = "/folders/";

	/** The page of the folder `id`. */
	static forFolder(id: string): string {
		return `${FolderRoute.PREFIX}${encodeURIComponent(id)}`;
	}
}
