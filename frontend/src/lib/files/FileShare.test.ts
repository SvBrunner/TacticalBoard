import { describe, it, expect, vi } from "vitest";
import { WebFileShare, type ShareNavigator } from "./FileShare";

const file = () => new File(["GIF89a"], "breakout.gif", { type: "image/gif" });

function navigatorWith(overrides: Partial<ShareNavigator> = {}): Required<ShareNavigator> {
	return {
		canShare: vi.fn(() => true),
		share: vi.fn(async () => undefined),
		...overrides,
	} as Required<ShareNavigator>;
}

describe("WebFileShare", () => {
	describe("canShare", () => {
		it("is true when the browser can share the file", () => {
			const nav = navigatorWith();
			const gif = file();

			expect(new WebFileShare(nav).canShare(gif)).toBe(true);
			expect(nav.canShare).toHaveBeenCalledWith({ files: [gif] });
		});

		it("is false when the browser can't share files", () => {
			expect(new WebFileShare(navigatorWith({ canShare: () => false })).canShare(file())).toBe(false);
		});

		it("is false without the Web Share API", () => {
			expect(new WebFileShare({}).canShare(file())).toBe(false);
			expect(new WebFileShare({ canShare: () => true }).canShare(file())).toBe(false);
			expect(new WebFileShare(undefined).canShare(file())).toBe(false);
		});

		it("is false when canShare throws", () => {
			const nav = navigatorWith({
				canShare: () => {
					throw new TypeError("bad data");
				},
			});

			expect(new WebFileShare(nav).canShare(file())).toBe(false);
		});
	});

	describe("share", () => {
		it("shares only the file and reports 'shared'", async () => {
			const nav = navigatorWith();
			const gif = file();

			await expect(new WebFileShare(nav).share(gif)).resolves.toBe("shared");

			expect(nav.share).toHaveBeenCalledWith({ files: [gif] });
		});

		it("treats closing the share sheet (AbortError) as 'cancelled', not as an error", async () => {
			const nav = navigatorWith({ share: vi.fn(async () => Promise.reject(new DOMException("Share canceled", "AbortError"))) });

			await expect(new WebFileShare(nav).share(file())).resolves.toBe("cancelled");
		});

		it("passes other errors on", async () => {
			const error = new DOMException("Not allowed", "NotAllowedError");
			const nav = navigatorWith({ share: vi.fn(async () => Promise.reject(error)) });

			await expect(new WebFileShare(nav).share(file())).rejects.toBe(error);
		});

		it("throws without calling the browser when the file can't be shared", async () => {
			const nav = navigatorWith({ canShare: () => false });

			await expect(new WebFileShare(nav).share(file())).rejects.toThrow(/not supported/);
			expect(nav.share).not.toHaveBeenCalled();
		});
	});
});
