import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { ToolState } from "./ToolState";
import { elementCatalog } from "$lib/components/board/ElementCatalog";

describe("ToolState", () => {
	it("starts with the Player tool and the default player color", () => {
		const tools = new ToolState();

		expect(tools.currentTool()).toBe("Player");
		expect(tools.currentPlayerColor()).toBe(elementCatalog.defaultPlayerColor);
	});

	it("selectTool changes the active tool", () => {
		const tools = new ToolState();

		tools.selectTool("Move");

		expect(tools.currentTool()).toBe("Move");
		expect(get(tools.activeTool)).toBe("Move");
	});

	it("selectPlayerColor changes the player color", () => {
		const tools = new ToolState();

		tools.selectPlayerColor("red");

		expect(tools.currentPlayerColor()).toBe("red");
		expect(get(tools.playerColor)).toBe("red");
	});
});
