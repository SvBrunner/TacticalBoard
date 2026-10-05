import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { i18n } from "$lib/i18n";
import type { TeamMember } from "$lib/teams/TeamApi";
import TeamMembers from "./TeamMembers.svelte";

const alice: TeamMember = { userId: "u1", displayName: "Alice", role: "admin", joinedAt: "2026-10-04T08:00:00Z" };
const bob: TeamMember = { userId: "u2", displayName: "Bob", role: "reader", joinedAt: "2026-10-05T08:00:00Z" };
const gone: TeamMember = { userId: "u9", displayName: null, role: "editor", joinedAt: "2026-10-05T08:00:00Z" };

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

function renderMembers(props: Partial<Parameters<typeof render<typeof TeamMembers>>[1] & object> = {}) {
	const onChangeRole = vi.fn(async (member: TeamMember, role: TeamMember["role"]) => ({ ok: true as const, value: { ...member, role } }));
	const onRemove = vi.fn(async (member: TeamMember) => ({ ok: true as const, value: member }));
	const onRetry = vi.fn();
	render(TeamMembers, {
		props: {
			list: { status: "loaded", members: [alice, bob, gone] },
			currentUserId: "u1",
			canManage: true,
			onChangeRole,
			onRemove,
			onRetry,
			...props,
		},
	});
	return { onChangeRole, onRemove, onRetry };
}

describe("TeamMembers", () => {
	afterEach(() => {
		cleanup();
	});

	it("lists every member with name and role, marking the user and deleted users", () => {
		renderMembers({ canManage: false });

		expect(screen.getByText("3 members")).toBeInTheDocument();
		const items = within(screen.getByRole("list", { name: "Members" })).getAllByRole("listitem");
		expect(items.map((item) => item.textContent?.replace(/\s+/g, " ").trim())).toEqual(["Alice (you) Admin", "Bob Reader", "Deleted user Editor"]);
		expect(screen.queryByRole("combobox")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("gives Admins a labelled role picker and a Remove button per member", () => {
		renderMembers();

		const picker = screen.getByRole("combobox", { name: "Role of Bob" });
		expect(picker).toHaveValue("reader");
		expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["Admin", "Editor", "Reader"]);
		expect(screen.getByRole("combobox", { name: "Role of Alice (you)" })).toHaveValue("admin");
		expect(screen.getByRole("button", { name: "Remove Deleted user" })).toBeInTheDocument();
	});

	it("changes a role and announces it", async () => {
		const { onChangeRole } = renderMembers();

		await fireEvent.change(screen.getByRole("combobox", { name: "Role of Bob" }), { target: { value: "editor" } });
		await settle();

		expect(onChangeRole).toHaveBeenCalledWith(bob, "editor");
		expect(screen.getByRole("status")).toHaveTextContent("Bob is now Editor.");
	});

	it("shows a refused change as an alert and keeps the shown role", async () => {
		renderMembers({ onChangeRole: vi.fn(async () => ({ ok: false as const, message: () => "“Lions” needs at least one Admin." })) });

		await fireEvent.change(screen.getByRole("combobox", { name: "Role of Alice (you)" }), { target: { value: "reader" } });
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("“Lions” needs at least one Admin.");
		expect(screen.getByRole("combobox", { name: "Role of Alice (you)" })).toHaveValue("admin");
	});

	it("removes a member through onRemove and says nothing when that was cancelled", async () => {
		const onRemove = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ ok: true, value: bob });
		renderMembers({ onRemove });

		await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
		await settle();
		expect(screen.getByRole("status")).toHaveTextContent("");

		await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
		await settle();
		expect(screen.getByRole("status")).toHaveTextContent("Bob was removed from the team.");
	});

	it("shows loading and a failure with Try again", async () => {
		const { onRetry } = renderMembers({ list: { status: "failed", message: () => "The members couldn't be loaded." } });

		expect(screen.getByRole("alert")).toHaveTextContent("The members couldn't be loaded.");
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledOnce();
		cleanup();

		renderMembers({ list: { status: "loading" } });
		expect(screen.getByRole("status")).toHaveTextContent("Loading members…");
	});

	it("speaks German", () => {
		i18n.select("de");
		renderMembers();

		expect(screen.getByText("3 Mitglieder")).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "Rolle von Alice (du)" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Bob entfernen" })).toBeInTheDocument();
	});
});
