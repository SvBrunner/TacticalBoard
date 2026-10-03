import { get, writable, type Readable } from "svelte/store";
import type { ElementType } from "$lib/model/elements/ElementType";
import { elementCatalog } from "$lib/components/board/ElementCatalog";

/** The active editing tool: Move (select/drag only) or a placement tool for an element type. */
export type Tool = "Move" | ElementType;

/** The active tool and the color new players get. Not undoable. */
export class ToolState {
	private readonly tool = writable<Tool>("Player");
	private readonly color = writable<string>(elementCatalog.defaultPlayerColor);

	readonly activeTool: Readable<Tool> = { subscribe: this.tool.subscribe };
	readonly playerColor: Readable<string> = { subscribe: this.color.subscribe };

	currentTool(): Tool {
		return get(this.tool);
	}

	currentPlayerColor(): string {
		return get(this.color);
	}

	selectTool(tool: Tool): void {
		this.tool.set(tool);
	}

	selectPlayerColor(color: string): void {
		this.color.set(color);
	}
}
