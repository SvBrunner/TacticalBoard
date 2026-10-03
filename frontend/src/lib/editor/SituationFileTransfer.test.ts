import { describe, it, expect, vi } from "vitest";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import {
	InvalidJsonError,
	LegacyFormatNotSupportedError,
	SituationImportError,
} from "$lib/model/serialization/SituationImportErrors";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { BrowserFileDownloader, SituationFileTransfer, type FileDownloader } from "./SituationFileTransfer";

class FakeDownloader implements FileDownloader {
	readonly downloads: { filename: string; content: string; mimeType: string }[] = [];

	download(filename: string, content: string, mimeType: string): void {
		this.downloads.push({ filename, content, mimeType });
	}
}

function situation(title = "Powerplay vs. 2-3-1"): Situation {
	return new Situation({
		id: "original",
		title,
		description: "",
		sport: "floorball",
		fieldType: "half",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-02T00:00:00.000Z",
		frames: [
			new Frame("f1", "one", [new PointElement("p1", 1, 2, "red", "Player")]),
			new Frame("f2", "two", [new PointElement("p1", 3, 4, "red", "Player")]),
		],
	});
}

function transfer(downloader = new FakeDownloader()) {
	return new SituationFileTransfer(new SituationSerializer(), downloader, new SequentialIdGenerator("new-"));
}

describe("SituationFileTransfer", () => {
	describe("filenameFor", () => {
		it.each([
			["Powerplay vs. 2-3-1", "powerplay-vs-2-3-1.situation.json"],
			["  Breakout  ", "breakout.situation.json"],
			["Überzahl Ä Ö ß", "ueberzahl-ae-oe-ss.situation.json"],
			["Défense côté", "defense-cote.situation.json"],
			["", "situation.json"],
			["   ", "situation.json"],
			["!!!", "situation.json"],
		])("%j -> %s", (title, expected) => {
			expect(transfer().filenameFor(situation(title))).toBe(expected);
		});
	});

	describe("export", () => {
		it("downloads the serialized situation under the slug filename", () => {
			const downloader = new FakeDownloader();
			const original = situation();

			const filename = transfer(downloader).export(original);

			expect(filename).toBe("powerplay-vs-2-3-1.situation.json");
			expect(downloader.downloads).toEqual([
				{
					filename,
					content: new SituationSerializer().serialize(original),
					mimeType: "application/json",
				},
			]);
		});
	});

	describe("import", () => {
		it("reads the file as a new situation: new situation id, same frame and element ids", async () => {
			const original = situation();
			const file = new File([new SituationSerializer().serialize(original)], "x.situation.json");

			const imported = await transfer().import(file);

			expect(imported.id).toBe("new-1");
			expect(imported.frames.map((frame) => frame.id)).toEqual(["f1", "f2"]);
			expect(imported.frames.map((frame) => frame.elements[0].id)).toEqual(["p1", "p1"]);
			expect(imported.withId(original.id)).toEqual(original);
		});

		it("rejects invalid JSON", async () => {
			const file = new File(["{nope"], "broken.json");

			await expect(transfer().import(file)).rejects.toBeInstanceOf(InvalidJsonError);
		});

		it("rejects the legacy array format", async () => {
			const file = new File([JSON.stringify([{ id: "a", x: 0, y: 0, color: "red", type: "Player" }])], "board.json");

			await expect(transfer().import(file)).rejects.toThrow(LegacyFormatNotSupportedError);
		});

		it("rejects invalid content with a SituationImportError", async () => {
			const file = new File([JSON.stringify({ format: "tacticalboard.situation", formatVersion: 1 })], "x.json");

			await expect(transfer().import(file)).rejects.toBeInstanceOf(SituationImportError);
		});
	});
});

describe("BrowserFileDownloader", () => {
	it("clicks a temporary download link with the encoded content and removes it again", () => {
		let clicked: HTMLAnchorElement | undefined;
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
			clicked = this;
			expect(document.body.contains(this)).toBe(true);
		});

		new BrowserFileDownloader(document).download("a.situation.json", '{"a": "ä"}', "application/json");

		expect(click).toHaveBeenCalledOnce();
		expect(clicked?.getAttribute("download")).toBe("a.situation.json");
		expect(clicked?.getAttribute("href")).toBe(
			`data:application/json;charset=utf-8,${encodeURIComponent('{"a": "ä"}')}`,
		);
		expect(document.body.contains(clicked!)).toBe(false);

		click.mockRestore();
	});
});
