import { FolderRoute } from "$lib/storage/FolderRoute";
import { TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";
import { SituationLink, type LinkState } from "$lib/storage/SituationLink";
import { TeamRoute } from "$lib/teams/TeamRoute";

/** Where the editor's badge leads: the start page, a folder's page, or a team's page. */
export interface EditorHome {
	readonly href: string;
	readonly kind: "start" | "folder" | "team";
}

/**
 * The place the editor works in (confirmed product decisions, arc42 ch. 8.8,
 * 8.15): the area and folder of the edited situation — a server situation's,
 * or where an unsaved one was started (`SituationLink.place`). The editor's
 * own New and Load (import) save there on their first save, and the badge
 * leads back there: to the folder's page, or for a team situation at the
 * top level to the team's page. Without a folder in the personal area, or in
 * local mode (not logged in), it is the top level of the personal area and
 * the start page.
 *
 * A place the user may only read (a team Reader viewing a team situation)
 * isn't used for New and Load: they start at the top level of the personal
 * area instead (conservative choice, an open domain question in the
 * roadmap); the badge still leads back to the team's folder or page.
 *
 * A value: the editor derives a new one whenever the link or the session
 * changes.
 */
export class EditorPlace {
	private readonly place: SaveTarget;

	/**
	 * @param place where the edited situation belongs (`SituationLink.place`)
	 * @param loggedIn whether a user is logged in (only then the areas exist for the editor)
	 * @param writable whether the user may save at `place` (`SituationLink.writable`)
	 */
	constructor(
		place: SaveTarget,
		loggedIn: boolean,
		private readonly writable = true,
	) {
		this.place = loggedIn ? place : TOP_LEVEL;
	}

	/** The place for the editor's situation link in `link`, with or without a logged-in user. */
	static of(link: LinkState, loggedIn: boolean): EditorPlace {
		return new EditorPlace(SituationLink.placeOf(link), loggedIn, SituationLink.isWritable(link));
	}

	/** Where a situation started in the editor (New, Load) is saved on its first save. */
	startTarget(): SaveTarget {
		return this.writable ? this.place : TOP_LEVEL;
	}

	/** Where the badge leads: the folder's page, the team's page, or the start page. */
	home(): EditorHome {
		if (this.place.folderId !== null) {
			return { href: FolderRoute.forFolder(this.place.folderId), kind: "folder" };
		}
		if (this.place.area.kind === "team") {
			return { href: TeamRoute.forTeam(this.place.area.teamId), kind: "team" };
		}
		return { href: "/", kind: "start" };
	}
}
