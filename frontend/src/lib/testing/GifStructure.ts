/** One image of a parsed GIF. */
export interface GifImage {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
	/** Delay of the graphic control extension before the image, in centiseconds (`null` without one). */
	readonly delayCs: number | null;
	/** The local color table as [r, g, b] triples, or `null` when the global one is used. */
	readonly localColors: readonly (readonly [number, number, number])[] | null;
}

/** The block structure of a GIF file (no pixel decoding). */
export interface GifStructure {
	readonly version: string;
	readonly width: number;
	readonly height: number;
	readonly globalColors: readonly (readonly [number, number, number])[] | null;
	/** NETSCAPE2.0 loop count (0 = forever), `null` without the extension. */
	readonly loopCount: number | null;
	readonly images: readonly GifImage[];
	/** Whether the file ends with the trailer (0x3B) right after the last block. */
	readonly complete: boolean;
}

/**
 * Test helper: reads the block structure of a GIF89a/87a file (header,
 * logical screen, color tables, NETSCAPE loop extension, graphic control
 * delays, image descriptors), skipping the image data. Throws for files
 * that aren't well-formed GIFs.
 */
export function parseGif(bytes: Uint8Array): GifStructure {
	let pos = 0;
	const byte = () => {
		if (pos >= bytes.length) {
			throw new Error("Unexpected end of GIF data");
		}
		return bytes[pos++];
	};
	const word = () => byte() | (byte() << 8);
	const colors = (count: number) => Array.from({ length: count }, () => [byte(), byte(), byte()] as const);
	const subBlocks = () => {
		const out: number[] = [];
		for (let size = byte(); size !== 0; size = byte()) {
			for (let i = 0; i < size; i++) out.push(byte());
		}
		return out;
	};

	const version = String.fromCharCode(...bytes.slice(0, 6));
	if (version !== "GIF89a" && version !== "GIF87a") {
		throw new Error(`Not a GIF: ${JSON.stringify(version)}`);
	}
	pos = 6;
	const width = word();
	const height = word();
	const packed = byte();
	byte(); // background color index
	byte(); // pixel aspect ratio
	const globalColors = packed & 0x80 ? colors(1 << ((packed & 0x07) + 1)) : null;

	let loopCount: number | null = null;
	let pendingDelay: number | null = null;
	const images: GifImage[] = [];
	for (;;) {
		const introducer = byte();
		if (introducer === 0x3b) {
			return { version, width, height, globalColors, loopCount, images, complete: pos === bytes.length };
		}
		if (introducer === 0x21) {
			const label = byte();
			const data = subBlocks();
			if (label === 0xf9) {
				pendingDelay = data[1] | (data[2] << 8);
			} else if (label === 0xff) {
				const id = String.fromCharCode(...data.slice(0, 11));
				if (id === "NETSCAPE2.0" && data[11] === 1) {
					loopCount = data[12] | (data[13] << 8);
				}
			}
		} else if (introducer === 0x2c) {
			const left = word();
			const top = word();
			const w = word();
			const h = word();
			const flags = byte();
			const localColors = flags & 0x80 ? colors(1 << ((flags & 0x07) + 1)) : null;
			byte(); // LZW minimum code size
			subBlocks();
			images.push({ left, top, width: w, height: h, delayCs: pendingDelay, localColors });
			pendingDelay = null;
		} else {
			throw new Error(`Unknown GIF block 0x${introducer.toString(16)} at ${pos - 1}`);
		}
	}
}
