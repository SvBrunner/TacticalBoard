/** Element types placed as a single point (x, y) on the board. */
export const POINT_ELEMENT_TYPES = ["Player", "Ball", "Rectangle", "Triangle", "Circle"] as const;

export type PointElementType = (typeof POINT_ELEMENT_TYPES)[number];

/** All element types the model can hold. Currently only point types; arrows follow later. */
export type ElementType = PointElementType;

export const ELEMENT_TYPES: readonly ElementType[] = POINT_ELEMENT_TYPES;

// The full set of element kinds shown in the UI, including Pass/Run/Shot,
// which aren't implemented yet (they need a start->end line interaction
// rather than a single click) and are rendered disabled.
export type SidebarElementType = ElementType | "Pass" | "Run" | "Shot";

export function isElementType(value: unknown): value is ElementType {
	return typeof value === "string" && (ELEMENT_TYPES as readonly string[]).includes(value);
}

export function isPointElementType(value: unknown): value is PointElementType {
	return typeof value === "string" && (POINT_ELEMENT_TYPES as readonly string[]).includes(value);
}
