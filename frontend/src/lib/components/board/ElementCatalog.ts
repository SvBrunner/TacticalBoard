import type { Messages } from "$lib/i18n/Messages";
import { sameFamily, type ElementType } from "$lib/model/elements/ElementType";

/** An element kind; its name in the UI is `messages.elements[type]`. */
export interface ElementKind {
	readonly type: ElementType;
}

/** The key of a color's name in the catalog (`messages.colors`). */
export type ColorId = keyof Messages["colors"];

/** A color of the palette; its name in the UI is `messages.colors[id]`. */
export interface NamedColor {
	readonly id: ColorId;
	readonly value: string;
}

/**
 * The element kinds and colors offered in the UI, shared by the tool panel,
 * the board and the edit popover so they always show the same choices. Their
 * names are system texts in the message catalog (arc42 ch. 8.18).
 */
export class ElementCatalog {
	readonly kinds: readonly ElementKind[] = [
		{ type: "Player" },
		{ type: "Ball" },
		{ type: "Pass" },
		{ type: "Run" },
		{ type: "Shot" },
		{ type: "Rectangle" },
		{ type: "Triangle" },
		{ type: "Circle" },
	];

	/** The colors new players can get (tool panel). */
	readonly playerColors: readonly NamedColor[] = [
		{ id: "teamA", value: "oklch(62% 0.16 230)" },
		{ id: "teamB", value: "oklch(64% 0.16 32)" },
		{ id: "teamC", value: "oklch(64% 0.14 150)" },
		{ id: "teamD", value: "oklch(78% 0.14 90)" },
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
		{ id: "grey", value: this.neutralColor },
		{ id: "black", value: this.arrowColor },
	];

	get defaultPlayerColor(): string {
		return this.playerColors[0].value;
	}

	/** The kinds an element of `type` can be changed to: its own family (point or arrow types). */
	kindsLike(type: ElementType): readonly ElementKind[] {
		return this.kinds.filter((kind) => sameFamily(kind.type, type));
	}

	/** The name of a color value in `messages`, or the value itself when it isn't in the palette. */
	colorName(value: string, messages: Messages): string {
		const color = this.colors.find((candidate) => candidate.value === value);
		return color ? messages.colors[color.id] : value;
	}
}

export const elementCatalog = new ElementCatalog();
