import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import NotificationStack from "./NotificationStack.svelte";
import { notifications } from "./Notifications";

describe("NotificationStack", () => {
	beforeEach(() => {
		notifications.clear();
	});

	it("renders nothing when there are no notifications", () => {
		render(NotificationStack);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("renders a toast for each notification, most recent last", async () => {
		render(NotificationStack);

		notifications.notify("first");
		notifications.notify("second");
		await Promise.resolve();

		const toasts = screen.getAllByRole("button");
		expect(toasts).toHaveLength(2);
		expect(toasts[0]).toHaveTextContent("first");
		expect(toasts[1]).toHaveTextContent("second");
	});

	it("clicking a toast dismisses it", async () => {
		render(NotificationStack);

		notifications.notify("dismiss me");
		await Promise.resolve();

		await fireEvent.click(screen.getByRole("button", { name: /dismiss me/i }));

		expect(screen.queryByText("dismiss me")).not.toBeInTheDocument();
	});
});
