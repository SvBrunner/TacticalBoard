import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import SaveStatus from "./SaveStatus.svelte";

describe("SaveStatus", () => {
	afterEach(() => cleanup());

	it("shows nothing and announces nothing when idle", () => {
		render(SaveStatus, { props: { state: { status: "idle" }, onDismiss: vi.fn() } });

		expect(screen.getByRole("status").textContent).toBe("");
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("announces saving and saved", async () => {
		const { rerender } = render(SaveStatus, { props: { state: { status: "saving" }, onDismiss: vi.fn() } });
		expect(screen.getByRole("status")).toHaveTextContent("Saving…");

		await rerender({ state: { status: "saved", title: "Powerplay" }, onDismiss: vi.fn() });

		expect(screen.getByRole("status")).toHaveTextContent('Saved "Powerplay".');
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("shows a failure as an alert that can be dismissed", async () => {
		const onDismiss = vi.fn();
		render(SaveStatus, { props: { state: { status: "failed", message: "The title is taken." }, onDismiss } });

		expect(screen.getByRole("alert")).toHaveTextContent("The title is taken.");
		await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
