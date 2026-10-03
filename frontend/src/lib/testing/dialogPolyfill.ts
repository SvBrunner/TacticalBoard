/**
 * jsdom implements `<dialog>` only as an element with an `open` attribute.
 * This adds minimal `showModal`/`show`/`close` (setting/removing `open` and
 * firing `close`), so components using the native dialog API can be tested.
 * Escape is not simulated: tests dispatch the `cancel` event the browser
 * would fire. Returns a restore function.
 */
export function installDialogPolyfill(): () => void {
	const prototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
	const originals = { showModal: prototype.showModal, show: prototype.show, close: prototype.close };

	function open(this: HTMLDialogElement): void {
		this.setAttribute("open", "");
	}

	prototype.showModal = open;
	prototype.show = open;
	prototype.close = function (this: HTMLDialogElement): void {
		if (!this.hasAttribute("open")) {
			return;
		}
		this.removeAttribute("open");
		this.dispatchEvent(new Event("close"));
	};

	return () => Object.assign(prototype, originals);
}

/** Fires the `cancel` event a browser fires when Escape is pressed in a modal dialog. */
export function pressEscapeIn(dialog: HTMLDialogElement): Event {
	const event = new Event("cancel", { cancelable: true });
	dialog.dispatchEvent(event);
	return event;
}
