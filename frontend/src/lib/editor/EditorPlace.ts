import { FolderRoute } from "$lib/storage/FolderRoute";
import { TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";
import { SituationLink, type LinkState } from "$lib/storage/SituationLink";

/** Where the editor's badge leads. */
export interface EditorHome {
	readonly href: string;
	/** True when it leads to a folder's page instead of the start page. */
	readonly inFolder: boolean;
}

/**
 * The place of the personal area the editor works in (confirmed product
 * decisions, arc42 ch. 8.8, 8.15): the folder of the edited situation — a
 * server situation's folder, or the folder an unsaved one was started in
 * (`SituationLink.place`). The editor's own New and Load (import) save there
 * on their first save, and the badge leads back to that folder's page.
 * Without a folder, or in local mode (not logged in), it is the top level
 * of the personal area and the start page.
 *
 * A value: the editor derives a new one whenever the link or the session
 * changes.
 */
export class EditorPlace {
	private readonly folderId: string | null;

	/**
	 * @param place where the edited situation belongs (`SituationLink.place`)
	 * @param loggedIn whether a user is logged in (only then the personal area's folders exist for the editor)
	 */
	constructor(place: SaveTarget, loggedIn: boolean) {
		this.folderId = loggedIn ? place.folderId : null;
	}

	/** The place for the editor's situation link in `link`, with or without a logged-in user. */
	static of(link: LinkState, loggedIn: boolean): EditorPlace {
		return new EditorPlace(SituationLink.placeOf(link), loggedIn);
	}

	/** Where a situation started in the editor (New, Load) is saved on its first save. */
	startTarget(): SaveTarget {
		return this.folderId === null ? TOP_LEVEL : { folderId: this.folderId };
	}

	/** Where the badge leads: the folder's page, or the start page. */
	home(): EditorHome {
		return this.folderId === null ? { href: "/", inFolder: false } : { href: FolderRoute.forFolder(this.folderId), inFolder: true };
	}
}
