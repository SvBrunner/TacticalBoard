/** Hands a file to the user as a download. */
export interface FileDownloader {
	download(filename: string, content: Blob): void;
}

/** The object-URL functions of `URL` the downloader uses. */
export interface ObjectUrls {
	createObjectURL(blob: Blob): string;
	revokeObjectURL(url: string): void;
}

/** Runs a function later (e.g. `setTimeout`). */
export type Defer = (run: () => void) => void;

/**
 * Triggers a browser download through a temporary link to an object URL.
 * The URL is revoked a while after the click (not right away: some
 * browsers still read it after `click()` returned), so the file's memory is
 * freed again.
 */
export class BrowserFileDownloader implements FileDownloader {
	/** How long the object URL stays valid after the download started. */
	static readonly REVOKE_DELAY_MS = 40_000;

	constructor(
		private readonly document: Document = globalThis.document,
		private readonly urls: ObjectUrls = URL,
		private readonly defer: Defer = (run) => setTimeout(run, BrowserFileDownloader.REVOKE_DELAY_MS),
	) {}

	download(filename: string, content: Blob): void {
		const url = this.urls.createObjectURL(content);
		const link = this.document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.display = "none";
		this.document.body.appendChild(link);
		try {
			link.click();
		} finally {
			this.document.body.removeChild(link);
			this.defer(() => this.urls.revokeObjectURL(url));
		}
	}
}
