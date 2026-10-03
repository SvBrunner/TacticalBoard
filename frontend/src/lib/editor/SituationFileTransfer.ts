import type { IdGenerator } from "$lib/model/ids/IdGenerator";
import { UuidIdGenerator } from "$lib/model/ids/IdGenerator";
import type { Situation } from "$lib/model/Situation";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";

export const SITUATION_FILE_EXTENSION = ".situation.json";
const FALLBACK_FILENAME = "situation.json";
const MIME_TYPE = "application/json";

/** Hands a text file to the user. */
export interface FileDownloader {
	download(filename: string, content: string, mimeType: string): void;
}

/** Triggers a browser download through a temporary link. */
export class BrowserFileDownloader implements FileDownloader {
	constructor(private readonly document: Document = globalThis.document) {}

	download(filename: string, content: string, mimeType: string): void {
		const link = this.document.createElement("a");
		link.setAttribute("href", `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`);
		link.setAttribute("download", filename);
		link.style.display = "none";
		this.document.body.appendChild(link);
		link.click();
		this.document.body.removeChild(link);
	}
}

const GERMAN_TRANSLITERATIONS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** Exports situations to files and imports them back. */
export class SituationFileTransfer {
	constructor(
		private readonly serializer: SituationSerializer = new SituationSerializer(),
		private readonly downloader: FileDownloader = new BrowserFileDownloader(),
		private readonly ids: IdGenerator = new UuidIdGenerator(),
	) {}

	/** Downloads the situation as a file and returns the file name used. */
	export(situation: Situation): string {
		const filename = this.filenameFor(situation);
		this.downloader.download(filename, this.serializer.serialize(situation), MIME_TYPE);
		return filename;
	}

	/**
	 * Reads a situation file. The result is always a new situation (fresh
	 * situation id); frame and element ids are kept.
	 * @throws SituationImportError when the file is not a valid situation file.
	 */
	async import(file: Blob): Promise<Situation> {
		const situation = this.serializer.deserialize(await file.text());
		return situation.withId(this.ids.next());
	}

	/** `<slug of title>.situation.json`, or `situation.json` when the title has no usable characters. */
	filenameFor(situation: Situation): string {
		const slug = this.slugify(situation.title);
		return slug === "" ? FALLBACK_FILENAME : `${slug}${SITUATION_FILE_EXTENSION}`;
	}

	private slugify(title: string): string {
		return title
			.toLowerCase()
			.replace(/[äöüß]/g, (char) => GERMAN_TRANSLITERATIONS[char])
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}
}
