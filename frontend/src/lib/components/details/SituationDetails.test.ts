import { describe, it, expect, vi } from "vitest";
import { createRawSnippet } from "svelte";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import SituationDetails from "./SituationDetails.svelte";

function renderDetails(props: Record<string, unknown> = {}) {
	const onTitleChange = vi.fn<(title: string) => void>();
	const onDescriptionChange = vi.fn<(description: string) => void>();
	const result = render(SituationDetails, {
		props: { title: "Breakout", description: "Use the *width*", onTitleChange, onDescriptionChange, ...props },
	});
	const panel = screen.getByRole("complementary", { name: "Details" });
	return {
		...result,
		onTitleChange,
		onDescriptionChange,
		panel,
		title: () => within(panel).getByRole("textbox", { name: "Title" }) as HTMLInputElement,
		description: () => within(panel).getByRole("textbox", { name: "Description" }) as HTMLTextAreaElement,
	};
}

describe("SituationDetails", () => {
	it("is a complementary landmark named Details with a heading", () => {
		const { panel } = renderDetails();

		expect(panel.tagName).toBe("ASIDE");
		expect(within(panel).getByRole("heading", { level: 2, name: "Details" })).toBeInTheDocument();
	});

	it("shows the title in a labelled text input", () => {
		const { title } = renderDetails();

		expect(title().tagName).toBe("INPUT");
		expect(title().value).toBe("Breakout");
	});

	it("shows the description's Markdown source in a labelled textarea", () => {
		const { description, panel } = renderDetails();

		expect(description().tagName).toBe("TEXTAREA");
		expect(description().value).toBe("Use the *width*");
		expect(panel.querySelector("em")).toBeNull();
	});

	it("reports title and description input", async () => {
		const { title, description, onTitleChange, onDescriptionChange } = renderDetails();

		await fireEvent.input(title(), { target: { value: "Breakout 2" } });
		await fireEvent.input(description(), { target: { value: "New" } });

		expect(onTitleChange).toHaveBeenCalledWith("Breakout 2");
		expect(onDescriptionChange).toHaveBeenCalledWith("New");
	});

	it("shows the placeholder for a blank title", () => {
		const { title } = renderDetails({ title: "", titlePlaceholder: "Untitled Situation" });

		expect(title().value).toBe("");
		expect(title()).toHaveAttribute("placeholder", "Untitled Situation");
	});

	it("follows changes from outside (e.g. another situation loaded)", async () => {
		const { title, description, rerender } = renderDetails();

		await rerender({ title: "Other", description: "Other text" });

		expect(title().value).toBe("Other");
		expect(description().value).toBe("Other text");
	});

	it("renders extra content below the fields", () => {
		const children = createRawSnippet(() => ({ render: () => "<p>Extra content</p>" }));
		const { panel } = renderDetails({ children });

		expect(within(panel).getByText("Extra content")).toBeInTheDocument();
	});

	describe("phone disclosure", () => {
		it("starts collapsed and toggles via the Details button", async () => {
			const { panel } = renderDetails();
			const toggle = within(panel).getByRole("button", { name: "Details" });
			const content = document.getElementById(toggle.getAttribute("aria-controls")!)!;

			expect(toggle).toHaveAttribute("aria-expanded", "false");
			expect(panel).not.toHaveClass("expanded");
			expect(content).toContainElement(within(panel).getByRole("textbox", { name: "Title" }));

			await fireEvent.click(toggle);
			expect(toggle).toHaveAttribute("aria-expanded", "true");
			expect(panel).toHaveClass("expanded");

			await fireEvent.click(toggle);
			expect(toggle).toHaveAttribute("aria-expanded", "false");
		});
	});

	describe("disabled (during playback)", () => {
		it("disables the title and description fields but keeps showing them", () => {
			const { title, description } = renderDetails({ disabled: true });

			expect(title()).toBeDisabled();
			expect(description()).toBeDisabled();
			expect(title().value).toBe("Breakout");
		});

		it("is enabled by default", () => {
			const { title, description } = renderDetails();

			expect(title()).toBeEnabled();
			expect(description()).toBeEnabled();
		});
	});
});
