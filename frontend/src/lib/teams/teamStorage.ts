import { apiClient } from "$lib/auth/AuthSession";
import { TeamApi } from "./TeamApi";

/** The app's server API for teams. */
export const teamApi = new TeamApi(apiClient);
