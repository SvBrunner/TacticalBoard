import type { PageLoad } from "./$types";

/** A folder's page (`/folders/<id>`, arc42 ch. 8.8): the folder is loaded by the page itself, so a missing one can be explained there. */
export const load: PageLoad = ({ params }) => ({ folderId: params.id });
