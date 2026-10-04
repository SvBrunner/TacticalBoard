import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import PositionPicker from "./PositionPicker.svelte";
import { PointElement } from "$lib/model/elements/PointElement";
import { PositionCatalog } from "$lib/model/positions/PositionCatalog";
import { i18n } from "$lib/i18n";

const player = new PointElement("el-1", 10, 20, "red", "Player");
const positions = PositionCatalog.forSport("floorball");

function fakeActions() {
	return { changeLabel: vi.fn(), endGesture: vi.fn() };
}

function props(overrides: Record<string, unknown> = {}) {
	return { element: player, positions, actions: fakeActions(), ...overrides };
}

const textbox = () => screen.getByRole("textbox", { name: "Custom" }) as HTMLInputElement;

describe("PositionPicker", () => {
	describe("structure and accessibility", () => {
		it("is a fieldset with a Position legend", () => {
			render(PositionPicker, { props: props() });

			const group = screen.getByRole("group", { name: "Position" });
			expect(group.tagName).toBe("FIELDSET");
		});

		it("lists None and every predefined position as radio chips, named by code and full name", () => {
			render(PositionPicker, { props: props() });

			const list = within(screen.getByRole("group", { name: "Position" })).getByRole("list");
			const radios = within(list).getAllByRole("radio");
			expect(within(list).getAllByRole("listitem")).toHaveLength(9);
			expect(radios.map((radio) => radio.closest("label")?.textContent?.trim())).toEqual([
				"None",
				"G (Goalie)",
				"V (Defender)",
				"C (Center)",
				"F (Wing)",
				"LV (Left defender)",
				"RV (Right defender)",
				"LF (Left wing)",
				"RF (Right wing)",
			]);
			expect(screen.getByRole("radio", { name: "None" })).toBeInTheDocument();
			expect(screen.getByRole("radio", { name: "LV (Left defender)" })).toBeInTheDocument();
		});

		it("names the positions in the UI language; the codes stay", async () => {
			i18n.select("de");
			render(PositionPicker, { props: props() });

			const group = screen.getByRole("group", { name: "Position" });
			expect(within(group).getByRole("radio", { name: "Keine" })).toBeInTheDocument();
			expect(within(group).getByRole("radio", { name: "LV (Linker Verteidiger)" })).toBeInTheDocument();
			expect(within(group).getByRole("radio", { name: "F (Flügel)" })).toBeInTheDocument();
			expect(screen.getByLabelText("Eigene")).toBeInTheDocument();
			expect(screen.getByText("Bis zu 2 Buchstaben oder Ziffern")).toBeInTheDocument();
		});

		it("the radios form one group (shared name), separate from another picker's group", () => {
			render(PositionPicker, { props: props() });
			render(PositionPicker, { props: props({ element: player.withLabel("C") }) });

			const [first, second] = screen.getAllByRole("group", { name: "Position" });
			const firstNames = new Set(within(first).getAllByRole("radio").map((radio) => radio.getAttribute("name")));
			const secondNames = new Set(within(second).getAllByRole("radio").map((radio) => radio.getAttribute("name")));
			expect(firstNames.size).toBe(1);
			expect(secondNames.size).toBe(1);
			expect([...firstNames][0]).not.toBe([...secondNames][0]);
		});

		it("has a labelled free-text input limited to 2 characters, with a hint", () => {
			render(PositionPicker, { props: props() });

			const input = textbox();
			expect(input).toHaveAttribute("type", "text");
			expect(input).toHaveAttribute("maxlength", "2");
			expect(input).toHaveAttribute("autocomplete", "off");
			expect(input).toHaveAccessibleDescription("Up to 2 letters or digits");
			expect(within(screen.getByRole("group", { name: "Position" })).getByRole("textbox")).toBe(input);
		});

		it("chips and the text field are touch-sized (at least the 44 px touch target)", () => {
			const source = readFileSync(join(process.cwd(), "src/lib/components/board/popover/PositionPicker.svelte"), "utf-8");
			const chip = source.match(/\n\t\.chip\s*\{([^}]*)\}/)?.[1] ?? "";
			const input = source.match(/\.custom input\s*\{([^}]*)\}/)?.[1] ?? "";

			expect(chip).toMatch(/min-height:\s*var\(--touch-target\)/);
			expect(source).toMatch(/minmax\(var\(--touch-target\), 1fr\)/);
			expect(input).toMatch(/min-height:\s*var\(--touch-target\)/);
			expect(input).toMatch(/font-size:\s*16px/);
		});
	});

	describe("showing the current label", () => {
		it("checks None and leaves the text field empty without a label", () => {
			render(PositionPicker, { props: props() });

			expect(screen.getByRole("radio", { name: "None" })).toBeChecked();
			expect(textbox()).toHaveValue("");
		});

		it("checks the matching chip and shows the code in the text field", () => {
			render(PositionPicker, { props: props({ element: player.withLabel("RF") }) });

			expect(screen.getByRole("radio", { name: /^RF\b/ })).toBeChecked();
			expect(screen.getByRole("radio", { name: "None" })).not.toBeChecked();
			expect(textbox()).toHaveValue("RF");
		});

		it("checks no chip for a free-text label", () => {
			render(PositionPicker, { props: props({ element: player.withLabel("10") }) });

			expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toEqual([]);
			expect(textbox()).toHaveValue("10");
		});

		it("follows label changes of the element", async () => {
			const { rerender } = render(PositionPicker, { props: props() });

			await rerender(props({ element: player.withLabel("G") }));

			expect(screen.getByRole("radio", { name: /^G\b/ })).toBeChecked();
			expect(textbox()).toHaveValue("G");
		});
	});

	describe("picking a chip", () => {
		it("sets that label and ends the edit session, so each pick is its own undo step", async () => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions }) });

			await fireEvent.click(screen.getByRole("radio", { name: /^C\b/ }));

			expect(actions.changeLabel).toHaveBeenCalledWith("el-1", "C");
			expect(actions.endGesture).toHaveBeenCalledOnce();
			expect(actions.changeLabel.mock.invocationCallOrder[0]).toBeLessThan(actions.endGesture.mock.invocationCallOrder[0]);
		});

		it("None removes the label", async () => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions, element: player.withLabel("C") }) });

			await fireEvent.click(screen.getByRole("radio", { name: "None" }));

			expect(actions.changeLabel).toHaveBeenCalledWith("el-1", "");
		});
	});

	describe("free text", () => {
		it("sets the typed label", async () => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions }) });

			await fireEvent.input(textbox(), { target: { value: "10" } });

			expect(actions.changeLabel).toHaveBeenCalledWith("el-1", "10");
			expect(actions.endGesture).not.toHaveBeenCalled();
		});

		it.each([
			["lv", "LV"],
			["c", "C"],
			["l-", "L"],
			["#9", "9"],
			["abc", "AB"],
			["", ""],
		])("normalizes %j to %j in the field and the model", async (typed, expected) => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions, element: player.withLabel("G") }) });

			await fireEvent.input(textbox(), { target: { value: typed } });

			expect(textbox()).toHaveValue(expected);
			expect(actions.changeLabel).toHaveBeenLastCalledWith("el-1", expected);
		});

		it("blur ends the edit session (one undo step per focus)", async () => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions }) });

			await fireEvent.input(textbox(), { target: { value: "1" } });
			await fireEvent.input(textbox(), { target: { value: "10" } });
			await fireEvent.blur(textbox());

			expect(actions.changeLabel).toHaveBeenCalledTimes(2);
			expect(actions.endGesture).toHaveBeenCalledOnce();
		});

		it("Enter ends the edit session", async () => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions }) });

			await fireEvent.keyDown(textbox(), { key: "Enter" });

			expect(actions.endGesture).toHaveBeenCalledOnce();
		});

		it("other keys do not end the edit session", async () => {
			const actions = fakeActions();
			render(PositionPicker, { props: props({ actions }) });

			await fireEvent.keyDown(textbox(), { key: "Backspace" });

			expect(actions.endGesture).not.toHaveBeenCalled();
		});
	});

	describe("edit session lifetime", () => {
		it("ends the session when the picker closes", () => {
			const actions = fakeActions();
			const { unmount } = render(PositionPicker, { props: props({ actions }) });

			unmount();

			expect(actions.endGesture).toHaveBeenCalledOnce();
		});

		it("ends the session when it switches to another element, but not on label changes", async () => {
			const actions = fakeActions();
			const { rerender } = render(PositionPicker, { props: props({ actions }) });

			await rerender(props({ actions, element: player.withLabel("1") }));
			await rerender(props({ actions, element: player.withLabel("10") }));
			expect(actions.endGesture).not.toHaveBeenCalled();

			await rerender(props({ actions, element: new PointElement("el-2", 0, 0, "red", "Player") }));
			expect(actions.endGesture).toHaveBeenCalledOnce();
		});
	});
});
