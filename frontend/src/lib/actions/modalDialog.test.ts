import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import { isInsideModalDialog, ModalDialog, modalDialog } from "./modalDialog";

describe("ModalDialog", () => {
	let restore: () => void;
	let dialog: HTMLDialogElement;
	let opener: HTMLButtonElement;
	let input: HTMLInputElement;

	beforeEach(() => {
		restore = installDialogPolyfill();
		opener = document.createElement("button");
		dialog = document.createElement("dialog");
		input = document.createElement("input");
		dialog.appendChild(input);
		document.body.append(opener, dialog);
		opener.focus();
	});

	afterEach(() => {
		document.body.replaceChildren();
		restore();
	});

	it("stays closed while open is false", () => {
		new ModalDialog(dialog, { open: false, onCancel: vi.fn() });

		expect(dialog.open).toBe(false);
	});

	it("opens as a modal and focuses the initial focus element", () => {
		const showModal = vi.spyOn(dialog, "showModal");

		new ModalDialog(dialog, { open: true, onCancel: vi.fn(), initialFocus: () => input });

		expect(showModal).toHaveBeenCalledOnce();
		expect(dialog.open).toBe(true);
		expect(document.activeElement).toBe(input);
	});

	it("focuses the dialog itself without an initial focus element", () => {
		dialog.tabIndex = -1;

		new ModalDialog(dialog, { open: true, onCancel: vi.fn() });

		expect(document.activeElement).toBe(dialog);
	});

	it("opens and closes when updated, returning focus to the opener", () => {
		const onCancel = vi.fn();
		const controller = new ModalDialog(dialog, { open: false, onCancel });

		controller.update({ open: true, onCancel, initialFocus: () => input });
		expect(dialog.open).toBe(true);

		controller.update({ open: false, onCancel });
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(opener);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it("does not reopen or refocus when updated while already open", () => {
		const onCancel = vi.fn();
		const controller = new ModalDialog(dialog, { open: true, onCancel, initialFocus: () => input });
		const showModal = vi.spyOn(dialog, "showModal");
		opener.focus();

		controller.update({ open: true, onCancel, initialFocus: () => input });

		expect(showModal).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(opener);
	});

	it("reports Escape as cancel and keeps the dialog open until the owner closes it", () => {
		const onCancel = vi.fn();
		new ModalDialog(dialog, { open: true, onCancel });

		const event = pressEscapeIn(dialog);

		expect(event.defaultPrevented).toBe(true);
		expect(onCancel).toHaveBeenCalledOnce();
		expect(dialog.open).toBe(true);
	});

	it("reports a close by the browser as cancel", () => {
		const onCancel = vi.fn();
		new ModalDialog(dialog, { open: true, onCancel, initialFocus: () => input });

		dialog.close();

		expect(onCancel).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(opener);
	});

	it("destroy closes an open dialog and stops listening", () => {
		const onCancel = vi.fn();
		const controller = new ModalDialog(dialog, { open: true, onCancel, initialFocus: () => input });

		controller.destroy();
		pressEscapeIn(dialog);

		expect(dialog.open).toBe(false);
		expect(onCancel).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(opener);
	});

	it("doesn't try to focus an opener that was removed", () => {
		const onCancel = vi.fn();
		const controller = new ModalDialog(dialog, { open: true, onCancel, initialFocus: () => input });
		opener.remove();

		expect(() => controller.update({ open: false, onCancel })).not.toThrow();
	});

	it("the Svelte action forwards update and destroy", () => {
		const onCancel = vi.fn();
		const action = modalDialog(dialog, { open: false, onCancel });

		action?.update?.({ open: true, onCancel });
		expect(dialog.open).toBe(true);

		action?.destroy?.();
		expect(dialog.open).toBe(false);
	});

	it("marks the dialog so isInsideModalDialog recognises targets inside it", () => {
		new ModalDialog(dialog, { open: true, onCancel: vi.fn() });

		expect(isInsideModalDialog(input)).toBe(true);
		expect(isInsideModalDialog(dialog)).toBe(true);
		expect(isInsideModalDialog(opener)).toBe(false);
	});
});

describe("isInsideModalDialog", () => {
	it("is false for unmanaged dialogs, non-elements and null", () => {
		const plain = document.createElement("dialog");
		const child = document.createElement("button");
		plain.appendChild(child);
		document.body.appendChild(plain);

		expect(isInsideModalDialog(child)).toBe(false);
		expect(isInsideModalDialog(window)).toBe(false);
		expect(isInsideModalDialog(null)).toBe(false);
		plain.remove();
	});
});
