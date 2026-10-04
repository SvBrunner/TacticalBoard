import type { Translatable } from "$lib/i18n/Messages";
import { ChoicePrompt } from "./ChoicePrompt";

/** What a confirmation dialog asks; the texts are translated when shown. */
export interface ConfirmationRequest {
	readonly title: Translatable;
	readonly message: Translatable;
	readonly confirmLabel: Translatable;
	readonly cancelLabel?: Translatable;
}

/**
 * A yes/no question for the reusable `ConfirmDialog`: `request` resolves
 * with `true` (confirmed) or `false` (cancelled). A new request answers the
 * previous one with "no".
 */
export class ConfirmationPrompt extends ChoicePrompt<ConfirmationRequest, boolean> {
	constructor() {
		super(false);
	}
}
