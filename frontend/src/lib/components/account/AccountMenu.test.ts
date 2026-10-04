import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import AccountMenu from "./AccountMenu.svelte";

const USER = { id: "1", displayName: "Alice Example", isSystemAdministrator: false };

function props(overrides: Record<string, unknown> = {}) {
	return {
		user: USER,
		onChangeDisplayName: vi.fn(),
		prepareLogout: vi.fn(async () => ({ name: "__RequestVerificationToken", value: "token-1" })),
		submitForm: vi.fn(),
		...overrides,
	};
}

const toggle = () => screen.getByRole("button", { name: "Alice Example" });
const options = () => document.querySelector<HTMLUListElement>('ul[aria-label="Account"]')!;

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

describe("AccountMenu", () => {
	describe("semantics", () => {
		it("is a disclosure button named by the user, controlling a list of choices", () => {
			render(AccountMenu, { props: props() });

			expect(toggle()).toHaveAttribute("type", "button");
			expect(toggle()).toHaveAttribute("aria-expanded", "false");
			expect(toggle()).toHaveAttribute("aria-controls", options().id);
			expect(options().tagName).toBe("UL");
			expect(within(options()).getAllByRole("listitem", { hidden: true })).toHaveLength(2);
		});

		it("logs out with a real POST form to /auth/logout", () => {
			render(AccountMenu, { props: props() });

			const logout = within(options()).getByRole("button", { name: "Log out", hidden: true });
			const form = logout.closest("form")!;
			expect(logout).toHaveAttribute("type", "submit");
			expect(form).toHaveAttribute("method", "post");
			expect(form).toHaveAttribute("action", "/auth/logout");
		});

		it("hides decorative icons from assistive technology", () => {
			const { container } = render(AccountMenu, { props: props() });

			for (const svg of container.querySelectorAll("svg")) {
				expect(svg).toHaveAttribute("aria-hidden", "true");
			}
		});
	});

	it("starts closed and opens on click", async () => {
		render(AccountMenu, { props: props() });
		expect(options()).not.toBeVisible();

		await fireEvent.click(toggle());

		expect(toggle()).toHaveAttribute("aria-expanded", "true");
		expect(options()).toBeVisible();
		expect(screen.getByRole("list", { name: "Account" })).toBe(options());
	});

	it("closes again on a second click", async () => {
		render(AccountMenu, { props: props() });

		await fireEvent.click(toggle());
		await fireEvent.click(toggle());

		expect(toggle()).toHaveAttribute("aria-expanded", "false");
	});

	it("Change display name closes the menu, returns focus and reports the choice", async () => {
		const p = props();
		render(AccountMenu, { props: p });
		await fireEvent.click(toggle());

		await fireEvent.click(screen.getByRole("button", { name: "Change display name" }));

		expect(p.onChangeDisplayName).toHaveBeenCalledOnce();
		expect(toggle()).toHaveAttribute("aria-expanded", "false");
		expect(toggle()).toHaveFocus();
	});

	it("Escape closes the menu and returns focus to the button", async () => {
		render(AccountMenu, { props: props() });
		await fireEvent.click(toggle());

		await fireEvent.keyDown(screen.getByRole("button", { name: "Change display name" }), { key: "Escape" });

		expect(toggle()).toHaveAttribute("aria-expanded", "false");
		expect(toggle()).toHaveFocus();
	});

	it("Escape does nothing while closed", async () => {
		render(AccountMenu, { props: props() });

		const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
		toggle().dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
	});

	it("a press elsewhere closes the menu", async () => {
		render(AccountMenu, { props: props() });
		await fireEvent.click(toggle());

		await fireEvent.pointerDown(document.body);

		expect(toggle()).toHaveAttribute("aria-expanded", "false");
	});

	it("a press inside keeps it open", async () => {
		render(AccountMenu, { props: props() });
		await fireEvent.click(toggle());

		await fireEvent.pointerDown(screen.getByRole("button", { name: "Change display name" }));

		expect(toggle()).toHaveAttribute("aria-expanded", "true");
	});

	it("focus moving elsewhere closes the menu", async () => {
		render(AccountMenu, { props: props() });
		await fireEvent.click(toggle());
		const outside = document.createElement("button");
		document.body.append(outside);

		await fireEvent.focusOut(toggle(), { relatedTarget: outside });

		expect(toggle()).toHaveAttribute("aria-expanded", "false");
		outside.remove();
	});

	it("focus moving inside keeps it open", async () => {
		render(AccountMenu, { props: props() });
		await fireEvent.click(toggle());

		await fireEvent.focusOut(toggle(), { relatedTarget: screen.getByRole("button", { name: "Log out" }) });

		expect(toggle()).toHaveAttribute("aria-expanded", "true");
	});

	it("Log out fetches the antiforgery field, puts it into the form and submits it", async () => {
		const p = props();
		render(AccountMenu, { props: p });
		await fireEvent.click(toggle());
		const logout = screen.getByRole("button", { name: "Log out" });

		await fireEvent.submit(logout.closest("form")!);
		await settle();

		expect(p.prepareLogout).toHaveBeenCalledOnce();
		const form = p.submitForm.mock.calls[0][0] as HTMLFormElement;
		expect(form).toBe(logout.closest("form"));
		const field = form.querySelector<HTMLInputElement>("input[type=hidden]")!;
		expect(field.name).toBe("__RequestVerificationToken");
		expect(field.value).toBe("token-1");
		expect(logout).toBeDisabled();
	});

	it("shows an error and allows a retry when the logout can't be prepared", async () => {
		const p = props({ prepareLogout: vi.fn(async () => Promise.reject(new Error("offline"))) });
		render(AccountMenu, { props: p });
		await fireEvent.click(toggle());
		const logout = screen.getByRole("button", { name: "Log out" });

		await fireEvent.submit(logout.closest("form")!);
		await settle();

		expect(p.submitForm).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Logging out failed. Please try again.");
		expect(logout).toBeEnabled();
	});

	it("ignores a second logout while the first is underway", async () => {
		let resolve: (field: { name: string; value: string }) => void = () => undefined;
		const p = props({ prepareLogout: vi.fn(() => new Promise((r) => (resolve = r))) });
		render(AccountMenu, { props: p });
		const form = screen.getByRole("button", { name: "Log out", hidden: true }).closest("form")!;

		await fireEvent.submit(form);
		await fireEvent.submit(form);
		resolve({ name: "f", value: "v" });
		await settle();

		expect(p.prepareLogout).toHaveBeenCalledOnce();
		expect(p.submitForm).toHaveBeenCalledOnce();
	});

	it("submits the form natively by default", async () => {
		const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
		const p = props();
		delete (p as Partial<typeof p>).submitForm;
		render(AccountMenu, { props: p });

		await fireEvent.submit(screen.getByRole("button", { name: "Log out", hidden: true }).closest("form")!);
		await settle();

		expect(submit).toHaveBeenCalledOnce();
		submit.mockRestore();
	});
});
