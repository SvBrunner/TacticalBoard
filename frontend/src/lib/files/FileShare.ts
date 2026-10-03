/** The parts of `navigator` the Web Share API needs. */
export interface ShareNavigator {
	canShare?: (data: ShareData) => boolean;
	share?: (data: ShareData) => Promise<void>;
}

/** What became of a share: shared, or the user closed the share sheet. */
export type ShareOutcome = "shared" | "cancelled";

/** Hands files to the platform's share sheet (e.g. on phones). */
export interface FileShare {
	/** Whether this file can be shared on this device. */
	canShare(file: File): boolean;
	/**
	 * Opens the share sheet. Must run in a user gesture (a click handler).
	 * @throws for real failures; closing the sheet is `"cancelled"`.
	 */
	share(file: File): Promise<ShareOutcome>;
}

/**
 * File sharing through the Web Share API (`navigator.share` with files),
 * feature-detected: where `navigator.canShare({ files })` isn't true (most
 * desktop browsers, older phones) nothing can be shared.
 */
export class WebFileShare implements FileShare {
	constructor(private readonly navigator: ShareNavigator | undefined = globalThis.navigator) {}

	canShare(file: File): boolean {
		const nav = this.navigator;
		if (typeof nav?.canShare !== "function" || typeof nav.share !== "function") {
			return false;
		}
		try {
			return nav.canShare({ files: [file] });
		} catch {
			return false;
		}
	}

	async share(file: File): Promise<ShareOutcome> {
		if (!this.canShare(file)) {
			throw new Error("Sharing files is not supported on this device");
		}
		try {
			await this.navigator!.share!({ files: [file] });
			return "shared";
		} catch (error) {
			if ((error as { name?: unknown } | null)?.name === "AbortError") {
				return "cancelled";
			}
			throw error;
		}
	}
}
