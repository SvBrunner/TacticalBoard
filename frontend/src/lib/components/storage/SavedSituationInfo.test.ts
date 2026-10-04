import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";
import { summaryOf } from "$lib/testing/storageFakes";
import SavedSituationInfo from "./SavedSituationInfo.svelte";

describe("SavedSituationInfo", () => {
	afterEach(() => cleanup());

	it("lists who created and who last changed the situation, and when", () => {
		const summary = summaryOf({
			createdBy: { id: "1", displayName: "Alice" },
			createdAt: "2026-10-01T08:00:00.000Z",
			updatedBy: { id: "2", displayName: "Bob" },
			updatedAt: "2026-10-04T09:30:00.000Z",
		});
		const { container } = render(SavedSituationInfo, { props: { summary } });

		const list = container.querySelector("dl")!;
		expect(list).toHaveAccessibleName("Saved on the server");
		const terms = screen.getAllByRole("term").map((term) => term.textContent);
		expect(terms).toEqual(["Created", "Last changed"]);
		const [created, changed] = screen.getAllByRole("definition");
		expect(created).toHaveTextContent(`by Alice, ${SavedSituationFormat.dateTime("2026-10-01T08:00:00.000Z")}`);
		expect(changed).toHaveTextContent(`by Bob, ${SavedSituationFormat.dateTime("2026-10-04T09:30:00.000Z")}`);
		expect(changed.querySelector("time")).toHaveAttribute("datetime", "2026-10-04T09:30:00.000Z");
	});

	it("shows a deleted user as 'Deleted user'", () => {
		render(SavedSituationInfo, { props: { summary: summaryOf({ updatedBy: { id: "2", displayName: null } }) } });

		expect(screen.getAllByRole("definition")[1]).toHaveTextContent("by Deleted user,");
	});
});
