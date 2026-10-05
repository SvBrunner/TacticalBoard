import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import TeamLogo from "./TeamLogo.svelte";

describe("TeamLogo", () => {
	afterEach(() => cleanup());

	it("shows the logo as a decorative image by default", () => {
		const { container } = render(TeamLogo, {
			props: { logoUrl: "/api/teams/ABC123/logo?v=1", name: "Lions" },
		});

		const image = container.querySelector("img")!;
		expect(image).toHaveAttribute("src", "/api/teams/ABC123/logo?v=1");
		expect(image).toHaveAttribute("alt", "");
		expect(image).toHaveAttribute("width", "40");
		expect(image).toHaveAttribute("loading", "lazy");
	});

	it("gives the logo a text alternative when asked to", () => {
		render(TeamLogo, {
			props: {
				logoUrl: "/logo",
				name: "Lions",
				size: 96,
				alt: "Logo of Lions",
			},
		});

		expect(screen.getByRole("img", { name: "Logo of Lions" })).toHaveAttribute("width", "96");
	});

	it("shows the first letter of the name, hidden from assistive technology, without a logo", () => {
		const { container } = render(TeamLogo, {
			props: { logoUrl: null, name: "  ämter" },
		});

		const placeholder = container.querySelector("span")!;
		expect(placeholder).toHaveTextContent("Ä");
		expect(placeholder).toHaveAttribute("aria-hidden", "true");
		expect(container.querySelector("img")).toBeNull();
	});

	it("shows a question mark for a blank name", () => {
		const { container } = render(TeamLogo, {
			props: { logoUrl: null, name: " " },
		});

		expect(container.querySelector("span")).toHaveTextContent("?");
	});
});
