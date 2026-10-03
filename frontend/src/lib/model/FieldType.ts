/** Which part of the field a situation shows. Chosen at creation, fixed afterwards. */
export const FIELD_TYPES = ["full", "half"] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export function isFieldType(value: unknown): value is FieldType {
	return typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);
}
