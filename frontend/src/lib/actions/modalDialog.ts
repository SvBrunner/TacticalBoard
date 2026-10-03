import type { Action } from "svelte/action";

export interface ModalDialogOptions {
	/** Whether the dialog is shown (as a modal, in the top layer). */
	readonly open: boolean;
	/** Called when the user dismisses the dialog (Escape, or the browser closing it). */
	readonly onCancel: () => void;
	/** The element to focus when the dialog opens; defaults to the dialog itself. */
	readonly initialFocus?: () => HTMLElement | null | undefined;
}

const MODAL_DIALOG_ATTRIBUTE = "data-modal-dialog";

/**
 * Whether `target` is inside a dialog driven by `ModalDialog`. Page-wide
 * keyboard shortcuts use it to stay out of the way while a modal is open.
 */
export function isInsideModalDialog(target: EventTarget | null): boolean {
	return (
		typeof Element !== "undefined" && target instanceof Element && target.closest(`[${MODAL_DIALOG_ATTRIBUTE}]`) !== null
	);
}

/**
 * Drives a native `<dialog>` from an `open` flag: `showModal()`/`close()`,
 * focus moved into the dialog on open and back to the previously focused
 * element on close, and Escape (the dialog's `cancel` event) reported as
 * `onCancel` instead of closing on its own — the owner decides by flipping
 * `open`.
 */
export class ModalDialog {
	private returnFocusTo: HTMLElement | null = null;
	private readonly handleCancel = (event: Event) => {
		event.preventDefault();
		this.options.onCancel();
	};
	private readonly handleClose = () => {
		// Closed by the browser (e.g. a repeated Escape it doesn't let us prevent).
		if (this.options.open) {
			this.restoreFocus();
			this.options.onCancel();
		}
	};

	constructor(
		private readonly dialog: HTMLDialogElement,
		private options: ModalDialogOptions,
	) {
		dialog.setAttribute(MODAL_DIALOG_ATTRIBUTE, "");
		dialog.addEventListener("cancel", this.handleCancel);
		dialog.addEventListener("close", this.handleClose);
		this.sync();
	}

	update(options: ModalDialogOptions): void {
		this.options = options;
		this.sync();
	}

	destroy(): void {
		this.dialog.removeEventListener("cancel", this.handleCancel);
		this.dialog.removeEventListener("close", this.handleClose);
		if (this.dialog.open) {
			this.dialog.close();
			this.restoreFocus();
		}
	}

	private sync(): void {
		if (this.options.open && !this.dialog.open) {
			const active = this.dialog.ownerDocument.activeElement;
			this.returnFocusTo = active instanceof HTMLElement ? active : null;
			this.dialog.showModal();
			(this.options.initialFocus?.() ?? this.dialog).focus();
		} else if (!this.options.open && this.dialog.open) {
			this.dialog.close();
			this.restoreFocus();
		}
	}

	private restoreFocus(): void {
		const target = this.returnFocusTo;
		this.returnFocusTo = null;
		if (target?.isConnected) {
			target.focus();
		}
	}
}

/** Svelte action wrapper around `ModalDialog`. */
export const modalDialog: Action<HTMLDialogElement, ModalDialogOptions> = (node, options) => {
	const controller = new ModalDialog(node, options);
	return {
		update: (next: ModalDialogOptions) => controller.update(next),
		destroy: () => controller.destroy(),
	};
};
