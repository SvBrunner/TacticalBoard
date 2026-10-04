import type { SportId } from "../Sport";

/**
 * A predefined position: the short code shown on the player (a stored
 * value, never translated). Its full name is a system text of the UI
 * language (`messages.positions[sport][code]`, arc42 ch. 8.18).
 */
export interface Position {
	readonly code: string;
}

/** The full names of a sport's positions by code, as the message catalog holds them. */
export type PositionNames = Readonly<Record<SportId, Readonly<Record<string, string>>>>;

/** Letters (any script) and decimal digits. */
const LABEL_CHARACTER = /^[\p{L}\p{Nd}]$/u;

const FLOORBALL_POSITIONS: readonly Position[] = [
	{ code: "G" },
	{ code: "V" },
	{ code: "C" },
	{ code: "F" },
	{ code: "LV" },
	{ code: "RV" },
	{ code: "LF" },
	{ code: "RF" },
];

const POSITIONS_BY_SPORT: Record<SportId, readonly Position[]> = {
	floorball: FLOORBALL_POSITIONS,
};

/**
 * The predefined position labels of a sport, plus the rules every label
 * follows, predefined or free text: empty (no label), or 1–2 characters,
 * each a letter or a digit (e.g. jersey numbers).
 *
 * Case: `normalize` (used for typed input) upper-cases letters so typed
 * codes match the predefined ones ("lv" → "LV"). `isValidLabel` (used for
 * imported files) accepts lower case too, so hand-edited files still load;
 * such labels are kept as they are.
 */
export class PositionCatalog {
	static readonly MAX_LABEL_LENGTH = 2;

	private constructor(
		readonly sport: SportId,
		readonly positions: readonly Position[],
	) {}

	static forSport(sport: SportId): PositionCatalog {
		return new PositionCatalog(sport, POSITIONS_BY_SPORT[sport]);
	}

	/** The full name of the position `code` in `names` (the catalog's `positions`), or the code itself. */
	nameOf(code: string, names: PositionNames): string {
		return names[this.sport]?.[code] ?? code;
	}

	/** The predefined position with this code, if any (exact match). */
	find(code: string): Position | undefined {
		return this.positions.find((position) => position.code === code);
	}

	/** True for "" (no label) or 1–2 letters/digits. Length counts characters, not UTF-16 units. */
	static isValidLabel(label: unknown): label is string {
		if (typeof label !== "string") {
			return false;
		}
		const characters = [...label];
		return characters.length <= PositionCatalog.MAX_LABEL_LENGTH && characters.every((c) => LABEL_CHARACTER.test(c));
	}

	/**
	 * Turns typed text into a valid label: drops everything that is not a
	 * letter or digit, upper-cases letters, and keeps the first two
	 * characters. The result always passes `isValidLabel`.
	 */
	static normalize(raw: string): string {
		return [...raw.normalize("NFC")]
			.filter((character) => LABEL_CHARACTER.test(character))
			.map((character) => PositionCatalog.upperCase(character))
			.slice(0, PositionCatalog.MAX_LABEL_LENGTH)
			.join("");
	}

	/** Upper case of one character, unless that would expand it (e.g. "ß" → "SS"). */
	private static upperCase(character: string): string {
		const upper = character.toUpperCase();
		return [...upper].length === 1 ? upper : character;
	}
}
