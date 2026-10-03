import { isElementType, type ElementType, type SidebarElementType } from "$lib/model/elements/ElementType";

export interface ElementKind {
	readonly type: SidebarElementType;
	readonly name: string;
	/** Shown but not usable yet (Pass/Run/Shot need a start→end line interaction). */
	readonly disabled: boolean;
}

export interface PlayerColor {
	readonly name: string;
	readonly value: string;
}

/**
 * The element kinds and player colors offered in the UI, shared by the tool
 * panel and the edit popover so both always show the same choices.
 */
export class ElementCatalog {
	readonly kinds: readonly ElementKind[] = [
		{ type: "Player", name: "Player", disabled: false },
		{ type: "Ball", name: "Ball", disabled: false },
		{ type: "Pass", name: "Pass", disabled: true },
		{ type: "Run", name: "Run", disabled: true },
		{ type: "Shot", name: "Shot", disabled: true },
		{ type: "Rectangle", name: "Rectangle", disabled: false },
		{ type: "Triangle", name: "Triangle", disabled: false },
		{ type: "Circle", name: "Circle", disabled: false },
	];

	readonly playerColors: readonly PlayerColor[] = [
		{ name: "Team A", value: "oklch(62% 0.16 230)" },
		{ name: "Team B", value: "oklch(64% 0.16 32)" },
		{ name: "Team C", value: "oklch(64% 0.14 150)" },
		{ name: "Team D", value: "oklch(78% 0.14 90)" },
	];

	/** Color of every placed element that isn't a Player. */
	readonly neutralColor = "oklch(45% 0.01 260)";

	get defaultPlayerColor(): string {
		return this.playerColors[0].value;
	}

	/** The model element type for a kind, or `undefined` when the kind is not usable yet. */
	usableType(kind: ElementKind): ElementType | undefined {
		return !kind.disabled && isElementType(kind.type) ? kind.type : undefined;
	}
}

export const elementCatalog = new ElementCatalog();
