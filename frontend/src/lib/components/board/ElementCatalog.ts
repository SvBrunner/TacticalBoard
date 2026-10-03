import { sameFamily, type ElementType } from "$lib/model/elements/ElementType";

export interface ElementKind {
	readonly type: ElementType;
	readonly name: string;
}

export interface NamedColor {
	readonly name: string;
	readonly value: string;
}

/**
 * The element kinds and colors offered in the UI, shared by the tool panel,
 * the board and the edit popover so they always show the same choices.
 */
export class ElementCatalog {
	readonly kinds: readonly ElementKind[] = [
		{ type: "Player", name: "Player" },
		{ type: "Ball", name: "Ball" },
		{ type: "Pass", name: "Pass" },
		{ type: "Run", name: "Run" },
		{ type: "Shot", name: "Shot" },
		{ type: "Rectangle", name: "Rectangle" },
		{ type: "Triangle", name: "Triangle" },
		{ type: "Circle", name: "Circle" },
	];

	/** The colors new players can get (tool panel). */
	readonly playerColors: readonly NamedColor[] = [
		{ name: "Team A", value: "oklch(62% 0.16 230)" },
		{ name: "Team B", value: "oklch(64% 0.16 32)" },
		{ name: "Team C", value: "oklch(64% 0.14 150)" },
		{ name: "Team D", value: "oklch(78% 0.14 90)" },
	];

	/** Color of every newly placed point element that isn't a Player. */
	readonly neutralColor = "oklch(45% 0.01 260)";

	/** Color of every newly drawn arrow. */
	readonly arrowColor = "oklch(15% 0 0)";

	/**
	 * The palette every element's color can be changed to in the edit
	 * popover: the player colors plus the neutral color and black, so every
	 * element can get back its initial color.
	 */
	readonly colors: readonly NamedColor[] = [
		...this.playerColors,
		{ name: "Grey", value: this.neutralColor },
		{ name: "Black", value: this.arrowColor },
	];

	get defaultPlayerColor(): string {
		return this.playerColors[0].value;
	}

	/** The kinds an element of `type` can be changed to: its own family (point or arrow types). */
	kindsLike(type: ElementType): readonly ElementKind[] {
		return this.kinds.filter((kind) => sameFamily(kind.type, type));
	}

	/** The display name of a color value, or the value itself when it isn't in the palette. */
	colorName(value: string): string {
		return this.colors.find((color) => color.value === value)?.name ?? value;
	}
}

export const elementCatalog = new ElementCatalog();
