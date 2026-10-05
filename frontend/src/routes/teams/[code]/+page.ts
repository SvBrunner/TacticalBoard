import type { PageLoad } from "./$types";

/** A team's page (`/teams/<CODE>`, arc42 ch. 8.8): the team is loaded by the page itself, so a missing one can be explained there. */
export const load: PageLoad = ({ params }) => ({ code: params.code });
