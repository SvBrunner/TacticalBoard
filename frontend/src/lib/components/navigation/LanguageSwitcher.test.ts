import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { i18n } from "$lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher.svelte";

describe("LanguageSwitcher", () => {
	it("is a select named 'Language' with every language in its own name and lang", () => {
		render(LanguageSwitcher);

		const select = screen.getByRole("combobox", { name: "Language" });
		expect(select).toHaveValue("en");
		const options = screen.getAllByRole("option");
		expect(options.map((option) => [option.textContent, option.getAttribute("value"), option.getAttribute("lang")])).toEqual([
			["Deutsch", "de", "de"],
			["English", "en", "en"],
		]);
	});

	it("reports the chosen language", async () => {
		const onChoose = vi.fn();
		render(LanguageSwitcher, { props: { onChoose } });

		await fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "de" } });

		expect(onChoose).toHaveBeenCalledWith("de");
	});

	it("by default switches the app's language (and <html lang>)", async () => {
		render(LanguageSwitcher);

		await fireEvent.change(screen.getByRole("combobox"), { target: { value: "de" } });
		await tick();

		expect(i18n.current()).toBe("de");
		expect(document.documentElement.lang).toBe("de");
		expect(screen.getByRole("combobox", { name: "Sprache" })).toHaveValue("de");
	});

	it("offers the given languages", () => {
		render(LanguageSwitcher, { props: { languages: [{ code: "en", name: "English" }] } });

		expect(screen.getAllByRole("option")).toHaveLength(1);
	});
});
