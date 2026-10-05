import { describe, it, expect, vi } from "vitest";
import { de, en } from "$lib/testing/i18n";
import { LogoChoice } from "./LogoChoice.svelte";

function file(type: string, size = 10, name = "logo") {
	const value = new File([new Uint8Array(1)], name, { type });
	Object.defineProperty(value, "size", { value: size });
	return value;
}

function choiceWithUrls() {
	let next = 0;
	const urls = { create: vi.fn(() => `blob:${++next}`), revoke: vi.fn() };
	return { choice: new LogoChoice(urls), urls };
}

describe("LogoChoice", () => {
	it.each(["image/png", "image/jpeg", "image/webp"])("keeps a %s with a preview", (type) => {
		const { choice, urls } = choiceWithUrls();
		const logo = file(type);

		choice.choose(logo);

		expect(choice.file).toBe(logo);
		expect(choice.previewUrl).toBe("blob:1");
		expect(choice.problem).toBeNull();
		expect(urls.create).toHaveBeenCalledWith(logo);
	});

	it.each(["image/svg+xml", "image/gif", "application/pdf", ""])("refuses %j with the reason", (type) => {
		const { choice, urls } = choiceWithUrls();

		choice.choose(file(type));

		expect(choice.file).toBeNull();
		expect(choice.previewUrl).toBeNull();
		expect(choice.problem?.(en)).toBe("Choose a PNG, JPEG or WebP image.");
		expect(urls.create).not.toHaveBeenCalled();
	});

	it("refuses an image larger than 5 MB", () => {
		const { choice } = choiceWithUrls();

		choice.choose(file("image/png", 5 * 1024 * 1024 + 1));

		expect(choice.problem?.(en)).toBe("The image is too large. Choose one of at most 5 MB.");
		expect(choice.problem?.(de)).toBe("Das Bild ist zu groß. Wähle eines mit höchstens 5 MB.");
		expect(LogoChoice.problemOf(file("image/png", 5 * 1024 * 1024))).toBeNull();
	});

	it("frees the previous preview when another image is chosen or the choice is cleared", () => {
		const { choice, urls } = choiceWithUrls();
		choice.choose(file("image/png"));

		choice.choose(file("image/jpeg"));
		expect(urls.revoke).toHaveBeenCalledWith("blob:1");
		expect(choice.previewUrl).toBe("blob:2");

		choice.clear();
		expect(urls.revoke).toHaveBeenCalledWith("blob:2");
		expect([choice.file, choice.previewUrl, choice.problem]).toEqual([null, null, null]);
	});

	it("choosing nothing clears the choice", () => {
		const { choice } = choiceWithUrls();
		choice.choose(file("image/gif"));

		choice.choose(null);

		expect(choice.problem).toBeNull();
	});

	it("tells the file input which types to offer", () => {
		expect(LogoChoice.ACCEPT).toBe("image/png,image/jpeg,image/webp");
		expect(LogoChoice.maxMegabytes).toBe(5);
	});

	it("uses the browser's object URLs by default", () => {
		const create = vi.fn(() => "blob:browser");
		const revoke = vi.fn();
		const original = {
			createObjectURL: URL.createObjectURL,
			revokeObjectURL: URL.revokeObjectURL,
		};
		Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
		try {
			const choice = new LogoChoice();

			choice.choose(file("image/png"));
			choice.clear();

			expect(create).toHaveBeenCalled();
			expect(revoke).toHaveBeenCalledWith("blob:browser");
		} finally {
			Object.assign(URL, original);
		}
	});
});
