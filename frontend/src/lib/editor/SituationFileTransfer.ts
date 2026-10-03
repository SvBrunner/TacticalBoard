import type { Clock } from "$lib/model/Clock";
import { SystemClock } from "$lib/model/Clock";
import type { IdGenerator } from "$lib/model/ids/IdGenerator";
import { UuidIdGenerator } from "$lib/model/ids/IdGenerator";
import type { Situation } from "$lib/model/Situation";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { BrowserFileDownloader, type FileDownloader } from "$lib/files/FileDownloader";
import { FileNameSlug } from "$lib/files/FileNameSlug";

export const SITUATION_FILE_EXTENSION = ".situation.json";
const FALLBACK_FILENAME = "situation.json";
export const SITUATION_FILE_MIME_TYPE = "application/json";

/** Exports situations to files and imports them back. */
export class SituationFileTransfer {
	constructor(
		private readonly serializer: SituationSerializer = new SituationSerializer(),
		private readonly downloader: FileDownloader = new BrowserFileDownloader(),
		private readonly ids: IdGenerator = new UuidIdGenerator(),
		private readonly clock: Clock = new SystemClock(),
	) {}

	/** Downloads the situation as a file and returns the file name used. */
	export(situation: Situation): string {
		const filename = this.filenameFor(situation);
		this.downloader.download(filename, new Blob([this.serializer.serialize(situation)], { type: SITUATION_FILE_MIME_TYPE }));
		return filename;
	}

	/**
	 * Reads a situation file. The result is always a new situation: fresh
	 * situation id, and `createdAt` = `updatedAt` = the import time; frame and
	 * element ids are kept.
	 * @throws SituationImportError when the file is not a valid situation file.
	 */
	async import(file: Blob): Promise<Situation> {
		const situation = this.serializer.deserialize(await file.text());
		const now = this.clock.now().toISOString();
		return situation.withId(this.ids.next()).withTimestamps(now, now);
	}

	/** `<slug of title>.situation.json`, or `situation.json` when the title has no usable characters. */
	filenameFor(situation: Situation): string {
		return FileNameSlug.fileName(situation.title, SITUATION_FILE_EXTENSION, FALLBACK_FILENAME);
	}
}
