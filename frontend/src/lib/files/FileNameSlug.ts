const GERMAN_TRANSLITERATIONS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * The file-name-safe form of a title, shared by every export (JSON, GIF):
 * lower case, German umlauts transliterated (ä → ae, …, ß → ss), other
 * accents dropped, every run of other characters becomes one "-", no
 * leading or trailing "-". Empty when the title has no usable characters.
 */
export class FileNameSlug {
	private constructor() {}

	static of(title: string): string {
		return title
			.toLowerCase()
			.replace(/[äöüß]/g, (char) => GERMAN_TRANSLITERATIONS[char])
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	/** `<slug><extension>`, or `fallback` when the title has no usable characters. */
	static fileName(title: string, extension: string, fallback: string): string {
		const slug = FileNameSlug.of(title);
		return slug === "" ? fallback : `${slug}${extension}`;
	}
}
