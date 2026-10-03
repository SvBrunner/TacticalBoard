import type { Command } from "$lib/history/Command";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/**
 * Changes a frame's description (Markdown source). A later description
 * change merges into this one (keeping the original text) until the history
 * is sealed, so one text-field edit session is one undo step.
 */
export class ChangeFrameDescriptionCommand implements FrameCommand {
	readonly label = "Change frame description";

	constructor(
		readonly from: string,
		readonly to: string,
	) {}

	static of(frame: Frame, description: string): ChangeFrameDescriptionCommand {
		return new ChangeFrameDescriptionCommand(frame.description, description);
	}

	execute(frame: Frame): Frame {
		return frame.withDescription(this.to);
	}

	undo(frame: Frame): Frame {
		return frame.withDescription(this.from);
	}

	isNoOp(frame: Frame): boolean {
		return frame.description === this.to;
	}

	mergeWith(next: Command<Frame>): FrameCommand | undefined {
		if (!(next instanceof ChangeFrameDescriptionCommand)) {
			return undefined;
		}
		return new ChangeFrameDescriptionCommand(this.from, next.to);
	}
}
