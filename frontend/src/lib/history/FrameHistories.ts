import type { Frame } from "$lib/model/Frame";
import { CommandHistory, DEFAULT_MAX_HISTORY_DEPTH } from "./CommandHistory";

/** One independent undo/redo history per frame, keyed by frame id and created on first use. */
export class FrameHistories {
	private readonly histories = new Map<string, CommandHistory<Frame>>();

	constructor(private readonly maxDepth: number = DEFAULT_MAX_HISTORY_DEPTH) {}

	for(frameId: string): CommandHistory<Frame> {
		let history = this.histories.get(frameId);
		if (!history) {
			history = new CommandHistory<Frame>(this.maxDepth);
			this.histories.set(frameId, history);
		}
		return history;
	}

	has(frameId: string): boolean {
		return this.histories.has(frameId);
	}

	/** Forgets every frame's history (e.g. when another situation is loaded). */
	clear(): void {
		this.histories.forEach((history) => history.clear());
		this.histories.clear();
	}
}
