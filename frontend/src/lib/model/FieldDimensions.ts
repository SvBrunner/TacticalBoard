import type { FieldType } from "./FieldType";
import type { SportId } from "./Sport";

/** An axis-aligned rectangle in full-field scene units. */
export interface SceneRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * Size of a sport's full field in scene units (origin top-left, x to the
 * right, y down). Element coordinates are always stored in these full-field
 * units, also for half-field situations.
 *
 * **Half-field convention:** a half-field situation always uses the RIGHT
 * half of the full field, `x ∈ [width / 2, width]`, `y ∈ [0, height]`. Which
 * half is shown is irrelevant to the user; fixing one keeps the data
 * unambiguous. Elements outside that half stay in the data, they are just
 * not visible.
 */
export class FieldDimensions {
	static readonly FLOORBALL = new FieldDimensions(2000, 1000);

	constructor(
		readonly width: number,
		readonly height: number,
	) {
		if (!(width > 0) || !(height > 0)) {
			throw new Error(`Field dimensions must be positive (got ${width} × ${height})`);
		}
	}

	static forSport(sport: SportId): FieldDimensions {
		switch (sport) {
			case "floorball":
				return FieldDimensions.FLOORBALL;
		}
	}

	/** The whole field. */
	get fullRect(): SceneRect {
		return { x: 0, y: 0, width: this.width, height: this.height };
	}

	/** The half used by half-field situations: the right half. */
	get halfRect(): SceneRect {
		return { x: this.width / 2, y: 0, width: this.width / 2, height: this.height };
	}

	/** The part of the field a situation of the given field type shows. */
	visibleRect(fieldType: FieldType): SceneRect {
		return fieldType === "half" ? this.halfRect : this.fullRect;
	}
}
