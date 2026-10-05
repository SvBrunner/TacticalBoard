import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import FrameDescriptionEditor from "./FrameDescriptionEditor.svelte";

function renderEditor(props: Partial<{ frameNumber: number; description: string; readonly: boolean }> = {}) {
	const onChange = vi.fn<(text: string) => void>();
	const onCommit = vi.fn<() => void>();
	const result = render(FrameDescriptionEditor, {
		props: { frameNumber: 2, description: "**Press** high", onChange, onCommit, ...props },
	});
	return { ...result, onChange, onCommit, field: () => screen.getByRole("textbox") as HTMLTextAreaElement };
}

describe("FrameDescriptionEditor", () => {
	it("is a labelled textarea with the frame number in the label", () => {
		const { field } = renderEditor();

		expect(screen.getByRole("textbox", { name: "Frame 2 description" })).toBe(field());
		expect(field().tagName).toBe("TEXTAREA");
		expect(document.querySelector("label")).toHaveAttribute("for", field().id);
	});

	it("shows the Markdown source as is (no rendering)", () => {
		const { field, container } = renderEditor();

		expect(field().value).toBe("**Press** high");
		expect(container.querySelector("strong")).toBeNull();
	});

	it("reports every input", async () => {
		const { field, onChange } = renderEditor();

		await fireEvent.input(field(), { target: { value: "**Press** higher" } });

		expect(onChange).toHaveBeenCalledWith("**Press** higher");
	});

	it("ends the edit session on blur", async () => {
		const { field, onCommit, onChange } = renderEditor();

		await fireEvent.blur(field());

		expect(onCommit).toHaveBeenCalledOnce();
		expect(onChange).not.toHaveBeenCalled();
	});

	it("shows another frame's text and number when the frame changes", async () => {
		const { field, rerender } = renderEditor();

		await rerender({ frameNumber: 3, description: "Switch sides" });

		expect(field().value).toBe("Switch sides");
		expect(screen.getByRole("textbox", { name: "Frame 3 description" })).toBe(field());
	});

	it("shows the description read-only when asked to", () => {
		const { field } = renderEditor({ readonly: true });

		expect(field()).toHaveAttribute("readonly");
		expect(field().value).toBe("**Press** high");
	});

	it("is editable by default", () => {
		const { field } = renderEditor();

		expect(field()).not.toHaveAttribute("readonly");
	});
});
