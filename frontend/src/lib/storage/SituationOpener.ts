import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import type { Situation } from "$lib/model/Situation";
import { SituationImportError } from "$lib/model/serialization/SituationImportErrors";
import type { SituationSummary, StoredSituation } from "./SituationApi";

/** The outcome of opening a saved situation. */
export type OpenOutcome =
	| { readonly status: "opened"; readonly situation: Situation }
	| { readonly status: "cancelled" }
	| { readonly status: "failed"; readonly message: string };

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
			this.log(`Opening situation ${id} failed: ${message}`, "error");
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

	private static messageFor(error: unknown): string {
		if (error instanceof ApiUnavailableError) {
			return "The server is not reachable.";
		}
		if (error instanceof ApiError) {
			if (error.status === 401) {
				return "Your session has ended. Please log in again.";
			}
			if (error.status === 404) {
				return "This situation no longer exists.";
			}
		}
		if (error instanceof SituationImportError) {
			return "The saved situation can't be read by this version of the app.";
		}
		return "The situation couldn't be opened.";
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
