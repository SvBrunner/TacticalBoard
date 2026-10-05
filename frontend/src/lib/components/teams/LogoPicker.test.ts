import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { LogoChoice } from "$lib/teams/LogoChoice.svelte";
import LogoPicker from "./LogoPicker.svelte";

function image(type = "image/png", name = "logo.png") {
	return new File([new Uint8Array(4)], name, { type });
}

async function pick(container: HTMLElement, file: File) {
	const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	await fireEvent.change(input);
	await tick();
}

describe("LogoPicker", () => {
	let choice: LogoChoice;

	beforeEach(() => {
		let next = 0;
		choice = new LogoChoice({
			create: () => `blob:${++next}`,
			revoke: () => undefined,
		});
	});

	afterEach(() => cleanup());

	it("is a group named Logo with the limits as its description and a button to choose an image", () => {
		const { container } = render(LogoPicker, { props: { choice } });

		const group = screen.getByRole("group", { name: "Logo (optional)" });
		expect(group).toHaveAccessibleDescription("PNG, JPEG or WebP, at most 5 MB. It's scaled down to fit 256 × 256 px.");
		expect(screen.getByRole("button", { name: "Choose image" })).toHaveAttribute("type", "button");
		const input = container.querySelector("input[type=file]")!;
		expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
	});

	it("opens the file picker from the button", async () => {
		const { container } = render(LogoPicker, { props: { choice } });
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		let opened = false;
		input.addEventListener("click", () => (opened = true));

		await fireEvent.click(screen.getByRole("button", { name: "Choose image" }));

		expect(opened).toBe(true);
	});

	it("previews the chosen image and can drop it again", async () => {
		const { container } = render(LogoPicker, { props: { choice } });

		await pick(container, image());

		expect(screen.getByRole("img", { name: "Preview of the logo" })).toHaveAttribute("src", "blob:1");
		expect(screen.getByRole("button", { name: "Choose another image" })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Don't use this image" }));
		expect(screen.queryByRole("img")).toBeNull();
		expect(choice.file).toBeNull();
	});

	it("refuses an SVG with the reason", async () => {
		const { container } = render(LogoPicker, { props: { choice } });

		await pick(container, image("image/svg+xml", "logo.svg"));

		expect(screen.getByRole("alert")).toHaveTextContent("Choose a PNG, JPEG or WebP image.");
		expect(screen.queryByRole("img")).toBeNull();
	});

	it("can be disabled while saving", () => {
		choice.choose(image());
		render(LogoPicker, { props: { choice, disabled: true } });

		for (const button of screen.getAllByRole("button")) {
			expect(button).toBeDisabled();
		}
	});
});
