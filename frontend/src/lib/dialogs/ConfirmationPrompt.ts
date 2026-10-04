import { ChoicePrompt } from "./ChoicePrompt";

/** What a confirmation dialog asks. */
export interface ConfirmationRequest {
	readonly title: string;
	readonly message: string;
	readonly confirmLabel: string;
	readonly cancelLabel?: string;
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
