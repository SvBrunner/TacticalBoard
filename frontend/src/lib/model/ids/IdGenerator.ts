import { v4 as uuidv4 } from "uuid";

/** Source of unique identifiers for situations, frames, and elements. */
export interface IdGenerator {
	next(): string;
}

/** Production generator: random UUID v4 values. */
export class UuidIdGenerator implements IdGenerator {
	next(): string {
		return uuidv4();
	}
}

/** Deterministic generator (`<prefix>1`, `<prefix>2`, …), intended for tests. */
export class SequentialIdGenerator implements IdGenerator {
	private counter = 0;

	constructor(private readonly prefix = "id-") {}

	next(): string {
		this.counter += 1;
		return `${this.prefix}${this.counter}`;
	}
}
