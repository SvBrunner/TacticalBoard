/** A position in full-field scene units. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

export function samePoint(a: Point, b: Point): boolean {
	return a.x === b.x && a.y === b.y;
}
