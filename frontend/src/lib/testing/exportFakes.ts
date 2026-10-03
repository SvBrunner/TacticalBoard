import { vi } from "vitest";
import type { FileShare, ShareOutcome } from "$lib/files/FileShare";
import type { SlideshowExportRequest, SlideshowExportResult } from "$lib/export/SlideshowExporter";

/** An exporter whose export the test finishes by hand. */
export class ControlledExporter {
	readonly requests: SlideshowExportRequest[] = [];
	private pending: { resolve: (result: SlideshowExportResult) => void; reject: (error: unknown) => void }[] = [];

	export = vi.fn((request: SlideshowExportRequest): Promise<SlideshowExportResult> => {
		this.requests.push(request);
		return new Promise((resolve, reject) => {
			this.pending.push({ resolve, reject });
			request.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
		});
	});

	finish(index = this.pending.length - 1): void {
		this.pending[index].resolve({
			blob: new Blob(["GIF89a"], { type: "image/gif" }),
			mimeType: "image/gif",
			fileExtension: ".gif",
			width: 1200,
			height: 600,
			frameCount: 3,
		});
	}

	fail(error: unknown, index = this.pending.length - 1): void {
		this.pending[index].reject(error);
	}
}

export class FakeShare implements FileShare {
	supported = true;
	outcome: ShareOutcome | Error = "shared";
	readonly shared: File[] = [];

	canShare(): boolean {
		return this.supported;
	}

	async share(file: File): Promise<ShareOutcome> {
		this.shared.push(file);
		if (this.outcome instanceof Error) {
			throw this.outcome;
		}
		return this.outcome;
	}
}
