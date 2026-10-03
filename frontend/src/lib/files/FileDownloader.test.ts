import { describe, it, expect, vi, afterEach } from "vitest";
import { BrowserFileDownloader, type ObjectUrls } from "./FileDownloader";

function fakeUrls(): ObjectUrls & { created: Blob[]; revoked: string[] } {
	const created: Blob[] = [];
	const revoked: string[] = [];
	return {
		created,
		revoked,
		createObjectURL: (blob) => {
			created.push(blob);
			return `blob:test/${created.length}`;
		},
		revokeObjectURL: (url) => {
			revoked.push(url);
		},
	};
}

describe("BrowserFileDownloader", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("clicks a temporary download link to an object URL of the blob and removes it again", () => {
		let clicked: HTMLAnchorElement | undefined;
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
			clicked = this;
			expect(document.body.contains(this)).toBe(true);
		});
		const urls = fakeUrls();
		const blob = new Blob(["GIF89a"], { type: "image/gif" });

		new BrowserFileDownloader(document, urls, () => {}).download("breakout.gif", blob);

		expect(click).toHaveBeenCalledOnce();
		expect(urls.created).toEqual([blob]);
		expect(clicked?.getAttribute("href")).toBe("blob:test/1");
		expect(clicked?.getAttribute("download")).toBe("breakout.gif");
		expect(document.body.contains(clicked!)).toBe(false);
	});

	it("revokes the object URL later, not before the click", () => {
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		const urls = fakeUrls();
		const deferred: (() => void)[] = [];

		new BrowserFileDownloader(document, urls, (run) => deferred.push(run)).download("a.gif", new Blob([]));

		expect(urls.revoked).toEqual([]);
		expect(deferred).toHaveLength(1);
		deferred[0]();
		expect(urls.revoked).toEqual(["blob:test/1"]);
	});

	it("by default revokes the URL after REVOKE_DELAY_MS", () => {
		vi.useFakeTimers();
		try {
			vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
			const urls = fakeUrls();

			new BrowserFileDownloader(document, urls).download("a.gif", new Blob([]));
			vi.advanceTimersByTime(BrowserFileDownloader.REVOKE_DELAY_MS - 1);
			expect(urls.revoked).toEqual([]);
			vi.advanceTimersByTime(1);

			expect(urls.revoked).toEqual(["blob:test/1"]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("removes the link and still revokes the URL when the click throws", () => {
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
			throw new Error("blocked");
		});
		const urls = fakeUrls();
		const deferred: (() => void)[] = [];

		expect(() => new BrowserFileDownloader(document, urls, (run) => deferred.push(run)).download("a.gif", new Blob([]))).toThrow(
			"blocked",
		);

		expect(document.querySelector("a[download]")).toBeNull();
		deferred.forEach((run) => run());
		expect(urls.revoked).toEqual(["blob:test/1"]);
	});
});
