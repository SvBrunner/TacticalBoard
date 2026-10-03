import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { AnimationExport } from "$lib/export/AnimationExport.svelte";
import { ExportResolution } from "$lib/export/ExportResolution";
import type { FileDownloader } from "$lib/files/FileDownloader";
import { Frame } from "$lib/model/Frame";
import type { FieldType } from "$lib/model/FieldType";
import { Situation } from "$lib/model/Situation";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import { ControlledExporter, FakeShare } from "$lib/testing/exportFakes";
import ExportAnimationDialog from "./ExportAnimationDialog.svelte";

function situation(fieldType: FieldType = "full"): Situation {
	return new Situation({
		id: "s1",
		title: "Powerplay Ü",
		description: "",
		sport: "floorball",
		fieldType,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: [new Frame("f1", "", []), new Frame("f2", "", []), new Frame("f3", "", [])],
	});
}

async function settle() {
	for (let i = 0; i < 5; i++) await Promise.resolve();
	await tick();
}

function setup(options: { fieldType?: FieldType; shareSupported?: boolean; open?: boolean } = {}) {
	const exporter = new ControlledExporter();
	const downloads: { filename: string; content: Blob }[] = [];
	const downloader: FileDownloader = { download: (filename, content) => downloads.push({ filename, content }) };
	const share = new FakeShare();
	share.supported = options.shareSupported ?? false;
	const flow = new AnimationExport({ exporter, downloader, share });
	flow.begin({ situation: situation(options.fieldType), settings: { frameDurationMs: 3000 } });
	const onClose = vi.fn();
	const result = render(ExportAnimationDialog, { props: { open: options.open ?? true, flow, onClose } });
	return { ...result, flow, exporter, downloads, share, onClose };
}

const dialog = () => screen.getByRole("dialog", { name: "Export animated GIF" }) as HTMLDialogElement;
const button = (name: string | RegExp) => within(dialog()).getByRole("button", { name });
const radio = (name: RegExp) => within(dialog()).getByRole("radio", { name }) as HTMLInputElement;

async function createAndFinish(s: ReturnType<typeof setup>) {
	await fireEvent.click(button("Create GIF"));
	s.exporter.finish();
	await settle();
}

describe("ExportAnimationDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	describe("semantics and defaults", () => {
		it("is a modal dialog named by its heading, with a dialog form", () => {
			setup();

			expect(dialog().tagName).toBe("DIALOG");
			expect(dialog()).toHaveAttribute("open");
			expect(within(dialog()).getByRole("heading", { level: 2, name: "Export animated GIF" })).toBeInTheDocument();
			expect(dialog().querySelector("form")).toHaveAttribute("method", "dialog");
		});

		it("offers the resolutions as radios in a Resolution fieldset, Medium preselected", () => {
			setup();

			const group = within(dialog()).getByRole("group", { name: "Resolution" });
			expect(group.tagName).toBe("FIELDSET");
			expect(within(group).getAllByRole("radio")).toHaveLength(3);
			expect(radio(/Medium/).checked).toBe(true);
			expect(radio(/Small/).checked).toBe(false);
		});

		it("shows each resolution's pixel size for a full field (landscape)", () => {
			setup();

			expect(radio(/Small/).closest("label")).toHaveTextContent("600 × 300 px");
			expect(radio(/Medium/).closest("label")).toHaveTextContent("1200 × 600 px");
			expect(radio(/Large/).closest("label")).toHaveTextContent("1800 × 900 px");
		});

		it("shows the half field's pixel size", () => {
			setup({ fieldType: "half" });

			expect(radio(/Medium/).closest("label")).toHaveTextContent("1200 × 1200 px");
		});

		it("shows the frame count and the frame duration from the playback settings, read-only", () => {
			setup();

			const terms = [...dialog().querySelectorAll("dl dt")].map((dt) => [dt.textContent?.trim(), dt.nextElementSibling?.textContent?.replace(/\s+/g, " ").trim()]);
			expect(terms).toEqual([
				["Frames", "3"],
				["Frame duration", "3 s (playback setting)"],
			]);
			expect(within(dialog()).queryByRole("combobox")).toBeNull();
			expect(within(dialog()).queryByRole("spinbutton")).toBeNull();
		});

		it("offers no caption, title or watermark options: only the resolution can be chosen", () => {
			setup();

			expect(within(dialog()).queryAllByRole("textbox")).toHaveLength(0);
			expect(within(dialog()).queryAllByRole("checkbox")).toHaveLength(0);
		});

		it("focuses Create GIF when it opens", () => {
			setup();

			expect(document.activeElement).toBe(button("Create GIF"));
			expect(button("Create GIF")).toHaveAttribute("type", "submit");
		});

		it("is closed while not open", () => {
			setup({ open: false });

			expect(document.querySelector("dialog")!.open).toBe(false);
		});
	});

	it("choosing a resolution changes the flow's resolution", async () => {
		const { flow } = setup();

		await fireEvent.click(radio(/Large/));

		expect(flow.resolution).toBe(ExportResolution.LARGE);
		expect(radio(/Large/).checked).toBe(true);
	});

	it("Create GIF exports at the chosen resolution", async () => {
		const { exporter } = setup();
		await fireEvent.click(radio(/Small/));

		await fireEvent.click(button("Create GIF"));

		expect(exporter.requests).toHaveLength(1);
		expect(exporter.requests[0].resolution).toBe(ExportResolution.SMALL);
	});

	describe("while creating", () => {
		it("shows a progress bar with the frame being rendered, and Cancel", async () => {
			const { exporter } = setup();

			await fireEvent.click(button("Create GIF"));
			exporter.requests[0].onProgress?.(1, 3);
			await tick();

			const progress = within(dialog()).getByRole("progressbar", { name: /frame 2 of 3/ });
			expect(progress.tagName).toBe("PROGRESS");
			expect(progress).toHaveAttribute("max", "3");
			expect((progress as HTMLProgressElement).value).toBe(1);
			expect(button("Cancel")).toBeInTheDocument();
			expect(within(dialog()).queryByRole("button", { name: "Create GIF" })).toBeNull();
			expect(dialog()).toHaveAttribute("aria-busy", "true");
		});

		it("moves focus to Cancel", async () => {
			setup();

			await fireEvent.click(button("Create GIF"));
			await settle();

			expect(document.activeElement).toBe(button("Cancel"));
		});

		it("locks the resolution choice", async () => {
			setup();

			await fireEvent.click(button("Create GIF"));

			expect(within(dialog()).getByRole("group", { name: "Resolution" })).toBeDisabled();
		});

		it("Cancel aborts the export and offers Create GIF again", async () => {
			const { exporter } = setup();
			await fireEvent.click(button("Create GIF"));

			await fireEvent.click(button("Cancel"));
			await settle();

			expect(exporter.requests[0].signal?.aborted).toBe(true);
			expect(within(dialog()).queryByRole("progressbar")).toBeNull();
			expect(button("Create GIF")).toBeInTheDocument();
			expect(dialog()).toHaveAttribute("open");
		});

		it("Escape cancels the export and closes the dialog", async () => {
			const { exporter, onClose } = setup();
			await fireEvent.click(button("Create GIF"));

			pressEscapeIn(dialog());
			await settle();

			expect(exporter.requests[0].signal?.aborted).toBe(true);
			expect(onClose).toHaveBeenCalledOnce();
		});
	});

	describe("when the GIF is ready", () => {
		it("names the file and offers Download, focused", async () => {
			const s = setup();

			await createAndFinish(s);

			expect(within(dialog()).getByRole("status")).toHaveTextContent("powerplay-ue.gif is ready");
			expect(document.activeElement).toBe(button("Download"));
		});

		it("Download downloads <slug>.gif as image/gif", async () => {
			const s = setup();
			await createAndFinish(s);

			await fireEvent.click(button("Download"));

			expect(s.downloads).toHaveLength(1);
			expect(s.downloads[0].filename).toBe("powerplay-ue.gif");
			expect(s.downloads[0].content.type).toBe("image/gif");
		});

		it("offers Share only where the device can share the file", async () => {
			const unsupported = setup({ shareSupported: false });
			await createAndFinish(unsupported);
			expect(within(dialog()).queryByRole("button", { name: "Share" })).toBeNull();
			cleanup();

			const supported = setup({ shareSupported: true });
			await createAndFinish(supported);
			await fireEvent.click(button("Share"));
			await settle();

			expect(supported.share.shared.map((file) => file.name)).toEqual(["powerplay-ue.gif"]);
		});

		it("shows when sharing failed", async () => {
			const s = setup({ shareSupported: true });
			s.share.outcome = new Error("Permission denied");
			await createAndFinish(s);

			await fireEvent.click(button("Share"));
			await settle();

			expect(within(dialog()).getByRole("alert")).toHaveTextContent("Sharing failed: Permission denied");
		});

		it("Close closes the dialog", async () => {
			const s = setup();
			await createAndFinish(s);

			await fireEvent.click(button("Close"));

			expect(s.onClose).toHaveBeenCalledOnce();
			expect(s.flow.phase.kind).toBe("idle");
		});
	});

	it("shows a failure as an alert and offers Try again", async () => {
		const { exporter } = setup();
		await fireEvent.click(button("Create GIF"));

		exporter.fail(new Error("out of memory"));
		await settle();

		expect(within(dialog()).getByRole("alert")).toHaveTextContent("The GIF could not be created: out of memory");
		await fireEvent.click(button("Try again"));
		expect(exporter.requests).toHaveLength(2);
	});

	it("Close (before creating) closes without exporting", async () => {
		const { onClose, exporter } = setup();

		await fireEvent.click(button("Close"));

		expect(onClose).toHaveBeenCalledOnce();
		expect(exporter.requests).toHaveLength(0);
	});

	it("Escape closes the dialog", async () => {
		const { onClose } = setup();

		const event = pressEscapeIn(dialog());

		expect(event.defaultPrevented).toBe(true);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("uses only buttons that don't submit, except Create GIF", () => {
		setup();

		for (const each of within(dialog()).getAllByRole("button")) {
			expect(each).toHaveAttribute("type", each.textContent?.trim() === "Create GIF" ? "submit" : "button");
		}
	});
});
