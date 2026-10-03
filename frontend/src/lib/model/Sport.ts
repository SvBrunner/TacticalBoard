/** Sports the app supports. The model stays sport-agnostic; only floorball exists for now. */
export const SUPPORTED_SPORTS = ["floorball"] as const;

export type SportId = (typeof SUPPORTED_SPORTS)[number];

export function isSportId(value: unknown): value is SportId {
	return typeof value === "string" && (SUPPORTED_SPORTS as readonly string[]).includes(value);
}
