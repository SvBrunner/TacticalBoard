import { apiClient } from "$lib/auth/AuthSession";
import { notifications } from "$lib/debug/Notifications";
import { situationEditor } from "$lib/editor/SituationEditor";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { FolderApi } from "./FolderApi";
import { SituationApi } from "./SituationApi";
import { situationLink } from "./SituationLink";
import { SituationOpener } from "./SituationOpener";

/** The app's server API for saved situations. */
export const situationApi = new SituationApi(apiClient);

/** The app's server API for folders. */
export const folderApi = new FolderApi(apiClient);

/** Situation ↔ document, shared by saving and opening. */
export const situationSerializer = new SituationSerializer();

/** Opens saved situations into the app's `situationEditor` (start page, reload of `/editor?situation=…`). */
export const situationOpener = new SituationOpener({
	editor: situationEditor,
	link: situationLink,
	api: situationApi,
	serializer: situationSerializer,
	log: notifications,
});
