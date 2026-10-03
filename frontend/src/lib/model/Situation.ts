import type { Clock } from "./Clock";
import type { FieldType } from "./FieldType";
import { Frame } from "./Frame";
import type { IdGenerator } from "./ids/IdGenerator";
import type { SportId } from "./Sport";

/** Title given to newly created situations. */
export const DEFAULT_SITUATION_TITLE = "Untitled Situation";

export interface SituationProps {
	readonly id: string;
	readonly title: string;
	/** Markdown source. */
	readonly description: string;
	readonly sport: SportId;
	readonly fieldType: FieldType;
	readonly frames: readonly Frame[];
	/** ISO 8601 timestamp. */
	readonly createdAt: string;
	/** ISO 8601 timestamp. */
	readonly updatedAt: string;
}

export interface CreateSituationOptions {
	readonly sport: SportId;
	readonly fieldType: FieldType;
	readonly title?: string;
	readonly description?: string;
}

/**
 * The core unit: an ordered, non-empty list of frames plus metadata.
 * Immutable: change methods return a new instance, or `this` when nothing
 * changes. Sport and field type are fixed after creation.
 *
 * Element coordinates are always in full-field scene units of the sport,
 * also for half-field situations.
 */
export class Situation implements SituationProps {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly sport: SportId;
	readonly fieldType: FieldType;
	readonly frames: readonly Frame[];
	readonly createdAt: string;
	readonly updatedAt: string;

	constructor(props: SituationProps) {
		if (props.frames.length === 0) {
			throw new Error("A situation needs at least one frame");
		}
		this.id = props.id;
		this.title = props.title;
		this.description = props.description;
		this.sport = props.sport;
		this.fieldType = props.fieldType;
		this.frames = [...props.frames];
		this.createdAt = props.createdAt;
		this.updatedAt = props.updatedAt;
	}

	static create(options: CreateSituationOptions, ids: IdGenerator, clock: Clock): Situation {
		const now = clock.now().toISOString();
		return new Situation({
			id: ids.next(),
			title: options.title ?? DEFAULT_SITUATION_TITLE,
			description: options.description ?? "",
			sport: options.sport,
			fieldType: options.fieldType,
			frames: [Frame.createEmpty(ids)],
			createdAt: now,
			updatedAt: now,
		});
	}

	/** The title to show in the UI: the default title when the title is blank. */
	get displayTitle(): string {
		return this.title.trim() === "" ? DEFAULT_SITUATION_TITLE : this.title;
	}

	frameAt(index: number): Frame | undefined {
		return this.frames[index];
	}

	findFrame(id: string): Frame | undefined {
		return this.frames.find((frame) => frame.id === id);
	}

	/** Position of the frame in the frame order, or -1 when the situation does not contain it. */
	indexOfFrame(id: string): number {
		return this.frames.findIndex((frame) => frame.id === id);
	}

	/**
	 * Inserts a frame at the given position (0 = first). The index is clamped
	 * to the valid range; a frame id that is already used throws.
	 */
	insertFrame(frame: Frame, index: number): Situation {
		if (this.findFrame(frame.id)) {
			throw new Error(`Situation ${this.id} already contains a frame with id ${frame.id}`);
		}
		const position = Situation.clampIndex(index, this.frames.length);
		return this.with({ frames: [...this.frames.slice(0, position), frame, ...this.frames.slice(position)] });
	}

	/**
	 * Removes a frame; an unknown id changes nothing. The last remaining
	 * frame can't be removed (a situation always has at least one frame).
	 */
	removeFrame(id: string): Situation {
		if (!this.findFrame(id)) {
			return this;
		}
		if (this.frames.length === 1) {
			throw new Error(`The last frame of situation ${this.id} can't be removed`);
		}
		return this.with({ frames: this.frames.filter((frame) => frame.id !== id) });
	}

	/**
	 * Moves a frame to another position in the frame order; `toIndex` is its
	 * index afterwards, clamped to the valid range. An unknown id or the same
	 * position changes nothing.
	 */
	moveFrame(id: string, toIndex: number): Situation {
		const from = this.indexOfFrame(id);
		if (from === -1) {
			return this;
		}
		const to = Situation.clampIndex(toIndex, this.frames.length - 1);
		if (to === from) {
			return this;
		}
		const frames = this.frames.filter((frame) => frame.id !== id);
		frames.splice(to, 0, this.frames[from]);
		return this.with({ frames });
	}

	updateFrame(id: string, update: (frame: Frame) => Frame): Situation {
		const existing = this.findFrame(id);
		if (!existing) {
			return this;
		}
		const updated = update(existing);
		if (updated === existing) {
			return this;
		}
		if (updated.id !== id) {
			throw new Error(`Updating frame ${id} must not change its id (got ${updated.id})`);
		}
		return this.with({ frames: this.frames.map((frame) => (frame.id === id ? updated : frame)) });
	}

	withTitle(title: string): Situation {
		return title === this.title ? this : this.with({ title });
	}

	withDescription(description: string): Situation {
		return description === this.description ? this : this.with({ description });
	}

	/** Same content under a different identity (used when importing a file as a new situation). */
	withId(id: string): Situation {
		return this.with({ id });
	}

	withUpdatedAt(updatedAt: string): Situation {
		return this.with({ updatedAt });
	}

	/** Sets both timestamps (used when importing a file as a new situation). */
	withTimestamps(createdAt: string, updatedAt: string): Situation {
		return this.with({ createdAt, updatedAt });
	}

	private static clampIndex(index: number, max: number): number {
		return Math.min(Math.max(Math.trunc(index), 0), max);
	}

	private with(changes: Partial<Omit<SituationProps, "sport" | "fieldType">>): Situation {
		return new Situation({ ...this.toProps(), ...changes });
	}

	private toProps(): SituationProps {
		return {
			id: this.id,
			title: this.title,
			description: this.description,
			sport: this.sport,
			fieldType: this.fieldType,
			frames: this.frames,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}
}
