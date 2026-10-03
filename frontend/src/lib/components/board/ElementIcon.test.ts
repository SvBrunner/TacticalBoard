import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import ElementIcon from "./ElementIcon.svelte";
import { elementCatalog } from "./ElementCatalog";

describe("ElementIcon", () => {
	it.each(elementCatalog.kinds.map((kind) => [kind.type]))("draws an icon for %s", (type) => {
		const { container } = render(ElementIcon, { props: { type } });

		const svg = container.querySelector("svg")!;
		expect(svg).toHaveAttribute("data-type", type);
		expect(svg.childElementCount).toBeGreaterThan(0);
	});

	it("draws a different icon per kind", () => {
		const markup = elementCatalog.kinds.map((kind) => {
			const { container, unmount } = render(ElementIcon, { props: { type: kind.type } });
			const inner = container.querySelector("svg")!.innerHTML;
			unmount();
			return inner;
		});

		expect(new Set(markup).size).toBe(markup.length);
	});

	it("is decorative (hidden from assistive technology)", () => {
		const { container } = render(ElementIcon, { props: { type: "Ball" } });

		const svg = container.querySelector("svg")!;
		expect(svg).toHaveAttribute("aria-hidden", "true");
		expect(svg).toHaveAttribute("focusable", "false");
	});

	it("uses the given size", () => {
		const { container } = render(ElementIcon, { props: { type: "Ball", size: 24 } });

		const svg = container.querySelector("svg")!;
		expect(svg).toHaveAttribute("width", "24");
		expect(svg).toHaveAttribute("height", "24");
	});
});
