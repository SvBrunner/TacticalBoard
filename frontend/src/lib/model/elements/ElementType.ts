/** Element types placed as a single point (x, y) on the board. */
export const POINT_ELEMENT_TYPES = ["Player", "Ball", "Rectangle", "Triangle", "Circle"] as const;

export type PointElementType = (typeof POINT_ELEMENT_TYPES)[number];

/** Element types drawn as an arrow from a start to an end point, optionally bent. */
export const ARROW_ELEMENT_TYPES = ["Pass", "Run", "Shot"] as const;

export type ArrowElementType = (typeof ARROW_ELEMENT_TYPES)[number];

/** All element types the model can hold. */
export type ElementType = PointElementType | ArrowElementType;

export const ELEMENT_TYPES: readonly ElementType[] = [...POINT_ELEMENT_TYPES, ...ARROW_ELEMENT_TYPES];

/** The two families of element types; an element's type can only change within its family. */
export type ElementFamily = "point" | "arrow";

export function isElementType(value: unknown): value is ElementType {
	return typeof value === "string" && (ELEMENT_TYPES as readonly string[]).includes(value);
}

export function isPointElementType(value: unknown): value is PointElementType {
	return typeof value === "string" && (POINT_ELEMENT_TYPES as readonly string[]).includes(value);
}

export function isArrowElementType(value: unknown): value is ArrowElementType {
	return typeof value === "string" && (ARROW_ELEMENT_TYPES as readonly string[]).includes(value);
}

export function familyOf(type: ElementType): ElementFamily {
	return isArrowElementType(type) ? "arrow" : "point";
}

/** Whether an element of type `a` may be changed to type `b` (both point types or both arrow types). */
export function sameFamily(a: ElementType, b: ElementType): boolean {
	return familyOf(a) === familyOf(b);
}
