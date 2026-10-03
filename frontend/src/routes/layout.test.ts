import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { situationEditor } from "$lib/editor/SituationEditor";
import { theme } from "$lib/theme";
import Layout from "./+layout.svelte";

const children = createRawSnippet(() => ({ render: () => "<p>page content</p>" }));

function beforeUnload(): Event {
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	return event;
}

describe("layout", () => {
	beforeEach(() => {
		theme.set("light");
		situationEditor.createNew({ title: "", fieldType: "full" });
	});

	it("renders the page inside the themed root", () => {
		const { container } = render(Layout, { props: { children } });

		const root = container.querySelector(".tb-root")!;
		expect(root).toHaveClass("light");
		expect(root).toHaveTextContent("page content");
	});

	it("follows the theme", async () => {
		const { container } = render(Layout, { props: { children } });

		theme.set("dark");
		await Promise.resolve();

		expect(container.querySelector(".tb-root")).toHaveClass("dark");
	});

	it("warns before leaving the page while there are unsaved changes", () => {
		render(Layout, { props: { children } });

		situationEditor.addElement(1, 1, "red", "Player");

		expect(beforeUnload().defaultPrevented).toBe(true);
	});

	it("doesn't warn when everything is saved", () => {
		render(Layout, { props: { children } });

		expect(beforeUnload().defaultPrevented).toBe(false);
	});

	it("stops warning once unmounted", () => {
		const { unmount } = render(Layout, { props: { children } });
		situationEditor.addElement(1, 1, "red", "Player");

		unmount();

		expect(beforeUnload().defaultPrevented).toBe(false);
	});
});
