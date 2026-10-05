import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { i18n } from "$lib/i18n";
import type { JoinRequest } from "$lib/teams/TeamApi";
import JoinRequests from "./JoinRequests.svelte";

const carol: JoinRequest = { id: "r1", user: { id: "u3", displayName: "Carol" }, requestedAt: "2026-10-05T09:00:00Z" };
const gone: JoinRequest = { id: "r2", user: { id: "u4", displayName: null }, requestedAt: "2026-10-05T10:00:00Z" };

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

function renderRequests(props: Record<string, unknown> = {}) {
	const onAccept = vi.fn(async () => ({ ok: true as const, value: { userId: "u3", displayName: "Carol", role: "reader" as const, joinedAt: "x" } }));
	const onReject = vi.fn(async (request: JoinRequest) => ({ ok: true as const, value: request }));
	const onRetry = vi.fn();
	render(JoinRequests, {
		props: { list: { status: "loaded", requests: [carol, gone] }, onAccept, onReject, onRetry, ...props },
	});
	return { onAccept, onReject, onRetry };
}

describe("JoinRequests", () => {
	afterEach(() => cleanup());

	it("lists who asked and when, with Accept and Reject per request", () => {
		renderRequests();

		const items = within(screen.getByRole("list", { name: "Join requests" })).getAllByRole("listitem");
		expect(items[0]).toHaveTextContent("Carol");
		expect(items[0]).toHaveTextContent("Asked Oct 5, 2026");
		expect(items[0].querySelector("time")).toHaveAttribute("datetime", carol.requestedAt);
		expect(items[1]).toHaveTextContent("Deleted user");
		expect(within(items[0]).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Accept Carol", "Reject Carol"]);
	});

	it("accepts and rejects, announcing the outcome", async () => {
		const { onAccept, onReject } = renderRequests();

		await fireEvent.click(screen.getByRole("button", { name: "Accept Carol" }));
		await settle();
		expect(onAccept).toHaveBeenCalledWith(carol);
		expect(screen.getByRole("status")).toHaveTextContent("Carol is now a member (Reader).");

		await fireEvent.click(screen.getByRole("button", { name: "Reject Deleted user" }));
		await settle();
		expect(onReject).toHaveBeenCalledWith(gone);
		expect(screen.getByRole("status")).toHaveTextContent("The request of Deleted user was rejected.");
	});

	it("shows a failed decision as an alert", async () => {
		renderRequests({ onReject: vi.fn(async () => ({ ok: false as const, message: () => "This request was already decided or no longer exists." })) });

		await fireEvent.click(screen.getByRole("button", { name: "Reject Carol" }));
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("This request was already decided or no longer exists.");
		expect(screen.getByRole("status")).toHaveTextContent("");
	});

	it("says when no one waits", () => {
		renderRequests({ list: { status: "loaded", requests: [] } });

		expect(screen.getByText("No one is waiting to join.")).toBeInTheDocument();
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("shows loading and a failure with Try again", async () => {
		const { onRetry } = renderRequests({ list: { status: "failed", message: () => "The join requests couldn't be loaded." } });

		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledOnce();
		cleanup();

		renderRequests({ list: { status: "loading" } });
		expect(screen.getByRole("status")).toHaveTextContent("Loading join requests…");
	});

	it("speaks German", () => {
		i18n.select("de");
		renderRequests();

		expect(screen.getByRole("button", { name: "Carol annehmen" })).toBeInTheDocument();
		expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Angefragt am 05.10.2026");
	});
});
