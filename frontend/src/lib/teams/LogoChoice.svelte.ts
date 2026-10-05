import type { Translatable } from "$lib/i18n/Messages";
import { ProblemText } from "$lib/i18n/ProblemText";
import { TeamApi } from "./TeamApi";

/** Creates and frees the object URLs a preview shows a chosen file with (the browser's `URL` by default). */
export interface ObjectUrls {
	create(file: File): string;
	revoke(url: string): void;
}

const browserUrls: ObjectUrls = {
	create: (file) => URL.createObjectURL(file),
	revoke: (url) => URL.revokeObjectURL(url),
};

/**
 * A logo image the user picked (arc42 ch. 8.17), before it is uploaded: the
 * file, a preview URL, or why it can't be used. Checks what the browser can
 * know — the type (PNG, JPEG, WebP; never SVG) and the size (at most 5 MB);
 * whether the image is readable only the server finds out. The preview URL is
 * freed when the choice changes or is cleared.
 */
export class LogoChoice {
	file = $state<File | null>(null);
	previewUrl = $state<string | null>(null);
	problem = $state<Translatable | null>(null);

	constructor(private readonly urls: ObjectUrls = browserUrls) {}

	/** The largest file in megabytes, as the texts show it. */
	static get maxMegabytes(): number {
		return ProblemText.megabytes(TeamApi.MAX_LOGO_BYTES);
	}

	/** The `accept` attribute of the file input. */
	static readonly ACCEPT = TeamApi.LOGO_TYPES.join(",");

	/** Why `file` can't be a logo, or `null`. */
	static problemOf(file: File): Translatable | null {
		if (!TeamApi.LOGO_TYPES.includes(file.type)) {
			return (m) => m.teams.logoUnsupported;
		}
		if (file.size > TeamApi.MAX_LOGO_BYTES) {
			return (m) => m.teams.logoTooLarge(LogoChoice.maxMegabytes);
		}
		return null;
	}

	/** The user picked `file` (or nothing): keeps it with a preview if usable, otherwise says why. */
	choose(file: File | null): void {
		this.clear();
		if (!file) {
			return;
		}
		const problem = LogoChoice.problemOf(file);
		if (problem) {
			this.problem = problem;
			return;
		}
		this.file = file;
		this.previewUrl = this.urls.create(file);
	}

	/** Drops the choice and frees its preview. */
	clear(): void {
		if (this.previewUrl) {
			this.urls.revoke(this.previewUrl);
		}
		this.file = null;
		this.previewUrl = null;
		this.problem = null;
	}
}
