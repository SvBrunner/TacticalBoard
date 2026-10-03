import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import type { ArrowElementType } from "$lib/model/elements/ElementType";
import type { Point } from "$lib/model/Point";

/** How an arrow type's line looks, in scene units (before the painter's scale). */
export interface ArrowLineStyle {
	/** Line width. */
	readonly width: number;
	/** Dash pattern (dash, gap, …); empty for a solid line. */
	readonly dash: readonly number[];
	/** A wavy line: amplitude and wavelength of the wave; `null` for a plain line. */
	readonly wave: { readonly amplitude: number; readonly wavelength: number } | null;
}

/** The parts of a 2D canvas context (or Konva's `Context` wrapper) the painter uses. */
export interface ArrowCanvas {
	beginPath(): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	closePath(): void;
	stroke(): void;
	fill(): void;
	setLineDash(segments: number[]): void;
	save(): void;
	restore(): void;
	lineWidth: number;
	lineCap: CanvasLineCap;
	lineJoin: CanvasLineJoin;
	strokeStyle: string | CanvasGradient | CanvasPattern;
	fillStyle: string | CanvasGradient | CanvasPattern;
}

/**
 * Draws arrows (pure: no Konva, testable with a fake context). Every type
 * has a fixed line style — Pass dashed, Run wavy, Shot thick — and the same
 * filled arrowhead at the end, oriented along the curve's end tangent. The
 * line stops under the arrowhead, so a thick line never pokes through its
 * tip. All sizes are scene units, multiplied by `scale` (1 on the board;
 * larger in the small frame thumbnails so they stay visible).
 */
export class ArrowPainter {
	static readonly STYLES: Readonly<Record<ArrowElementType, ArrowLineStyle>> = {
		Pass: { width: 4, dash: [18, 12], wave: null },
		Run: { width: 4, dash: [], wave: { amplitude: 7, wavelength: 28 } },
		Shot: { width: 9, dash: [], wave: null },
	};

	/** Arrowhead length along the tangent and half its base width (scene units). */
	static readonly HEAD = { length: 26, halfWidth: 13 } as const;

	/** Samples per curve segment for the drawn line. */
	private static readonly SAMPLES_PER_SEGMENT = 24;
	/** Distance between the points of a wavy line (scene units, before scaling). */
	private static readonly WAVE_STEP = 2;

	constructor(readonly scale = 1) {}

	/** The line style of `type`, scaled. */
	style(type: ArrowElementType): ArrowLineStyle {
		const style = ArrowPainter.STYLES[type];
		return {
			width: style.width * this.scale,
			dash: style.dash.map((length) => length * this.scale),
			wave: style.wave && {
				amplitude: style.wave.amplitude * this.scale,
				wavelength: style.wave.wavelength * this.scale,
			},
		};
	}

	get headLength(): number {
		return ArrowPainter.HEAD.length * this.scale;
	}

	get headHalfWidth(): number {
		return ArrowPainter.HEAD.halfWidth * this.scale;
	}

	/**
	 * The arrowhead triangle: tip (= the arrow's end), then the two base
	 * corners, perpendicular to the end tangent.
	 */
	head(geometry: ArrowGeometry): [Point, Point, Point] {
		const tip = geometry.end;
		const direction = geometry.endTangent();
		const base = { x: tip.x - direction.x * this.headLength, y: tip.y - direction.y * this.headLength };
		const normal = { x: -direction.y, y: direction.x };
		return [
			tip,
			{ x: base.x + normal.x * this.headHalfWidth, y: base.y + normal.y * this.headHalfWidth },
			{ x: base.x - normal.x * this.headHalfWidth, y: base.y - normal.y * this.headHalfWidth },
		];
	}

	/**
	 * The line from the start along the curve to just inside the arrowhead,
	 * as a polyline; for a wavy type the wave is applied (fading in at the
	 * start and out at the end). Empty when the arrow is shorter than its head.
	 */
	shaft(geometry: ArrowGeometry, type: ArrowElementType): Point[] {
		const path = new Polyline(geometry.sample(ArrowPainter.SAMPLES_PER_SEGMENT));
		// Ends inside the head (half its length): covered by the head, no gap at the base.
		const length = path.length - this.headLength / 2;
		if (!(length > 0)) {
			return [];
		}
		const wave = this.style(type).wave;
		if (!wave) {
			return path.until(length);
		}
		const step = ArrowPainter.WAVE_STEP * this.scale;
		const count = Math.max(1, Math.ceil(length / step));
		const fade = wave.wavelength / 2;
		const points: Point[] = [];
		for (let i = 0; i <= count; i++) {
			const distance = (length * i) / count;
			const { point, normal } = path.at(distance);
			const envelope = Math.min(1, distance / fade, (length - distance) / fade);
			const offset = wave.amplitude * envelope * Math.sin((2 * Math.PI * distance) / wave.wavelength);
			points.push({ x: point.x + normal.x * offset, y: point.y + normal.y * offset });
		}
		return points;
	}

	/** Draws the arrow: its line in the type's style, then the filled arrowhead. */
	paint(canvas: ArrowCanvas, geometry: ArrowGeometry, type: ArrowElementType, color: string): void {
		const style = this.style(type);
		canvas.save();
		canvas.strokeStyle = color;
		canvas.fillStyle = color;
		canvas.lineCap = style.dash.length > 0 ? "butt" : "round";
		canvas.lineJoin = "round";

		const shaft = this.shaft(geometry, type);
		if (shaft.length > 1) {
			canvas.lineWidth = style.width;
			canvas.setLineDash([...style.dash]);
			ArrowPainter.trace(canvas, shaft);
			canvas.stroke();
		}

		canvas.setLineDash([]);
		ArrowPainter.trace(canvas, this.head(geometry));
		canvas.closePath();
		canvas.fill();
		canvas.restore();
	}

	/** Traces the whole curve as a path (no styles, no stroke), e.g. for a hit region. */
	traceCurve(canvas: Pick<ArrowCanvas, "beginPath" | "moveTo" | "lineTo">, geometry: ArrowGeometry): void {
		ArrowPainter.trace(canvas, geometry.sample(ArrowPainter.SAMPLES_PER_SEGMENT));
	}

	private static trace(canvas: Pick<ArrowCanvas, "beginPath" | "moveTo" | "lineTo">, points: readonly Point[]): void {
		canvas.beginPath();
		points.forEach((point, index) => (index === 0 ? canvas.moveTo(point.x, point.y) : canvas.lineTo(point.x, point.y)));
	}
}

/** A polyline with arc-length lookups. */
class Polyline {
	/** Cumulative length at each point. */
	private readonly distances: number[];

	constructor(private readonly points: readonly Point[]) {
		this.distances = [0];
		for (let i = 1; i < points.length; i++) {
			this.distances.push(this.distances[i - 1] + Polyline.distance(points[i - 1], points[i]));
		}
	}

	get length(): number {
		return this.distances[this.distances.length - 1];
	}

	/** The point at arc length `distance` and the unit normal (direction rotated by +90°) there. */
	at(distance: number): { point: Point; normal: Point } {
		const index = this.segmentIndexAt(distance);
		const a = this.points[index];
		const b = this.points[index + 1] ?? a;
		const span = this.distances[index + 1] - this.distances[index];
		const t = span > 0 ? (distance - this.distances[index]) / span : 0;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const norm = Math.hypot(dx, dy) || 1;
		return { point: { x: a.x + dx * t, y: a.y + dy * t }, normal: { x: -dy / norm, y: dx / norm } };
	}

	/** The polyline from its start up to arc length `distance`. */
	until(distance: number): Point[] {
		const index = this.segmentIndexAt(distance);
		return [...this.points.slice(0, index + 1), this.at(distance).point];
	}

	/** Index of the segment containing arc length `distance` (clamped to the existing segments). */
	private segmentIndexAt(distance: number): number {
		let index = 0;
		while (index < this.points.length - 2 && this.distances[index + 1] < distance) {
			index++;
		}
		return index;
	}

	private static distance(a: Point, b: Point): number {
		return Math.hypot(b.x - a.x, b.y - a.y);
	}
}
