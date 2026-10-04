import { describe, it, expect, afterEach, vi } from "vitest";
import { tick } from "svelte";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import SaveStatus from "./SaveStatus.svelte";
import { i18n } from "$lib/i18n";

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

		expect(screen.getByRole("status")).toHaveTextContent("Saved “Powerplay”.");
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("shows a failure as an alert that can be dismissed", async () => {
		const onDismiss = vi.fn();
		render(SaveStatus, { props: { state: { status: "failed", message: (m) => m.saving.duplicateTitle("Powerplay") }, onDismiss } });

		expect(screen.getByRole("alert")).toHaveTextContent("A situation titled “Powerplay” already exists.");
		await fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("shows the failure and its button in the UI language, also after switching", async () => {
		render(SaveStatus, { props: { state: { status: "failed", message: (m) => m.saving.folderGone }, onDismiss: vi.fn() } });
		expect(screen.getByRole("alert")).toHaveTextContent("The folder to save in no longer exists");

		i18n.select("de");
		await tick();

		expect(screen.getByRole("alert")).toHaveTextContent("Der Ordner zum Speichern existiert nicht mehr");
		expect(screen.getByRole("button", { name: "Ausblenden" })).toBeInTheDocument();
	});
});
