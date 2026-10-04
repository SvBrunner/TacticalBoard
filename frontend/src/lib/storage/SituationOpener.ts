import { ApiError } from "$lib/api/ApiClient";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import { ProblemText } from "$lib/i18n/ProblemText";
import type { Situation } from "$lib/model/Situation";
import { SituationImportError } from "$lib/model/serialization/SituationImportErrors";
import type { SituationSummary, StoredSituation } from "./SituationApi";

/** The outcome of opening a saved situation. */
export type OpenOutcome =
	| { readonly status: "opened"; readonly situation: Situation }
	| { readonly status: "cancelled" }
	| { readonly status: "failed"; readonly message: Translatable };

export interface SituationOpenerDependencies {
	readonly editor: { load(situation: Situation): void };
	readonly link: { attach(summary: SituationSummary): void };
	readonly api: { get(id: string): Promise<StoredSituation> };
	readonly serializer: { fromDocument(raw: unknown): Situation };
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * Opens a saved situation in the editor (arc42 ch. 8.15): loads it from the
 * server, then — like an import — asks "Discard changes?" if needed, and
 * replaces the editor's situation with it. The editor then knows it as a
 * server situation (for later saves and the shown metadata).
 */
export class SituationOpener {
	constructor(private readonly deps: SituationOpenerDependencies) {}

	/**
	 * Opens `id`; `confirmDiscard` runs after it was loaded successfully and
	 * may cancel (e.g. "Discard changes?"). Never throws.
	 */
	async open(id: string, confirmDiscard: () => Promise<boolean> = async () => true): Promise<OpenOutcome> {
		let stored: StoredSituation;
		let situation: Situation;
		try {
			stored = await this.deps.api.get(id);
			situation = this.deps.serializer.fromDocument(stored.document);
		} catch (error) {
			const message = SituationOpener.messageFor(error);
			this.log(`Opening situation ${id} failed: ${inEnglish(message)}`, "error");
			return { status: "failed", message };
		}
		if (!(await confirmDiscard())) {
			this.log(`Opening "${stored.title}" cancelled`);
			return { status: "cancelled" };
		}
		this.deps.editor.load(situation);
		const { document: _document, ...summary } = stored;
		this.deps.link.attach(summary);
		this.log(`Opened "${stored.title}" (revision ${stored.revision})`);
		return { status: "opened", situation };
	}

	private static messageFor(error: unknown): Translatable {
		if (error instanceof ApiError && error.status === 404) {
			return (m) => m.saved.notFound;
		}
		if (error instanceof SituationImportError) {
			return (m) => m.saved.unreadable;
		}
		return ProblemText.describe(error, (m) => m.saved.openGenericFailure);
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
