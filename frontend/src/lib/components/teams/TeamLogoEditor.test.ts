import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import type { Team } from "$lib/teams/TeamApi";
import TeamLogoEditor from "./TeamLogoEditor.svelte";

const team: Team = {
	id: "t1",
	code: "ABC123",
	name: "Lions",
	logoUrl: null,
	createdAt: "2026-10-04T08:00:00Z",
	role: "admin",
	joinRequestPending: false,
	pendingJoinRequests: 0,
};
const withLogo: Team = { ...team, logoUrl: "/api/teams/ABC123/logo?v=1" };

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

async function pick(container: HTMLElement, file: File) {
	const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	await fireEvent.change(input);
	await settle();
}

describe("TeamLogoEditor", () => {
	afterEach(() => cleanup());

	it("offers Upload logo without a logo, Replace and Remove with one", async () => {
		const view = render(TeamLogoEditor, {
			props: { team, upload: vi.fn(), remove: vi.fn() },
		});
		expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["Upload logo"]);

		await view.rerender({ team: withLogo, upload: vi.fn(), remove: vi.fn() });
		expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["Replace logo", "Remove logo"]);
		expect(view.container.querySelector("input[type=file]")).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
	});

	it("opens the file picker from the button", async () => {
		const { container } = render(TeamLogoEditor, {
			props: { team, upload: vi.fn(), remove: vi.fn() },
		});
		const click = vi.fn();
		container.querySelector("input[type=file]")!.addEventListener("click", click);

		await fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));

		expect(click).toHaveBeenCalledOnce();
	});

	it("uploads a chosen image at once and says so", async () => {
		const upload = vi.fn(async () => ({ ok: true as const, team: withLogo }));
		const { container } = render(TeamLogoEditor, {
			props: { team, upload, remove: vi.fn() },
		});
		const file = new File([new Uint8Array(1)], "logo.jpg", {
			type: "image/jpeg",
		});

		await pick(container, file);

		expect(upload).toHaveBeenCalledWith(file);
		expect(screen.getByRole("status")).toHaveTextContent("Logo saved.");
	});

	it("announces the upload while it runs and disables the buttons", async () => {
		let finish: (value: { ok: true; team: Team }) => void = () => undefined;
		const upload = vi.fn(() => new Promise<{ ok: true; team: Team }>((resolve) => (finish = resolve)));
		const { container } = render(TeamLogoEditor, {
			props: { team, upload, remove: vi.fn() },
		});

		await pick(container, new File([new Uint8Array(1)], "logo.png", { type: "image/png" }));

		expect(screen.getByRole("status")).toHaveTextContent("Uploading the logo…");
		expect(screen.getByRole("button", { name: "Upload logo" })).toBeDisabled();
		finish({ ok: true, team: withLogo });
		await settle();
		expect(screen.getByRole("button", { name: "Upload logo" })).toBeEnabled();
	});

	it("refuses a file that can't be a logo without uploading it", async () => {
		const upload = vi.fn();
		const { container } = render(TeamLogoEditor, {
			props: { team, upload, remove: vi.fn() },
		});

		await pick(container, new File(["GIF89a"], "logo.gif", { type: "image/gif" }));

		expect(upload).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Choose a PNG, JPEG or WebP image.");
	});

	it("shows why an upload failed", async () => {
		const upload = vi.fn(async () => ({
			ok: false as const,
			message: () => "The logo must be a PNG, JPEG or WebP image.",
		}));
		const { container } = render(TeamLogoEditor, {
			props: { team, upload, remove: vi.fn() },
		});

		await pick(container, new File([new Uint8Array(1)], "logo.png", { type: "image/png" }));

		expect(screen.getByRole("alert")).toHaveTextContent("The logo must be a PNG, JPEG or WebP image.");
		expect(screen.getByRole("status")).toHaveTextContent("");
	});

	it("removes the logo at once through remove", async () => {
		const remove = vi.fn().mockResolvedValueOnce({ ok: true, team });
		render(TeamLogoEditor, {
			props: { team: withLogo, upload: vi.fn(), remove },
		});

		await fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
		await settle();

		expect(screen.getByRole("status")).toHaveTextContent("Logo removed.");
		expect(remove).toHaveBeenCalledOnce();
	});

	it("shows why the logo couldn't be removed", async () => {
		const remove = vi.fn().mockResolvedValueOnce({ ok: false, message: () => "The logo couldn't be removed." });
		render(TeamLogoEditor, {
			props: { team: withLogo, upload: vi.fn(), remove },
		});

		await fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("The logo couldn't be removed.");
		expect(screen.getByRole("status")).toHaveTextContent("");
	});

	it("ignores an empty file choice", async () => {
		const upload = vi.fn();
		const { container } = render(TeamLogoEditor, {
			props: { team, upload, remove: vi.fn() },
		});
		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		Object.defineProperty(input, "files", { value: [], configurable: true });

		await fireEvent.change(input);

		expect(upload).not.toHaveBeenCalled();
	});

	it("hides its icons from assistive technology", () => {
		const { container } = render(TeamLogoEditor, {
			props: { team: withLogo, upload: vi.fn(), remove: vi.fn() },
		});

		for (const svg of container.querySelectorAll("svg")) {
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});
});
