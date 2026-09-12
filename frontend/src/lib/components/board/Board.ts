import { writable, type Readable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";

export type ElementType = "Player" | "Ball" | "Rectangle" | "Triangle" | "Circle";

// The full set of element kinds shown in the UI, including Pass/Run/Shot,
// which aren't implemented yet (they need a start->end line interaction
// rather than a single click) and are rendered disabled.
export type SidebarElementType = ElementType | "Pass" | "Run" | "Shot";

export class BoardElement {
	constructor(
		public readonly id: string,
		public x: number,
		public y: number,
		public color: string,
		public type: ElementType,
	) {}

	static create(x: number, y: number, color: string, type: ElementType): BoardElement {
		return new BoardElement(uuidv4(), x, y, color, type);
	}
}

export class Board {
	private readonly store = writable<BoardElement[]>([]);

	readonly elements: Readable<BoardElement[]> = { subscribe: this.store.subscribe };

	addElement(x: number, y: number, color: string, type: ElementType): void {
		this.store.update((elements) => [...elements, BoardElement.create(x, y, color, type)]);
	}

	removeElement(id: string): void {
		this.store.update((elements) => elements.filter((element) => element.id !== id));
	}

	moveElement(id: string, x: number, y: number): void {
		this.updateElement(id, (element) => {
			element.x = x;
			element.y = y;
		});
	}

	changeColor(id: string, color: string): void {
		this.updateElement(id, (element) => {
			element.color = color;
		});
	}

	changeType(id: string, type: ElementType): void {
		this.updateElement(id, (element) => {
			element.type = type;
		});
	}

	serialize(): string {
		let current: BoardElement[] = [];
		this.store.subscribe((elements) => (current = elements))();
		return JSON.stringify(current);
	}

	loadFromJson(serialized: string): void {
		const parsed = JSON.parse(serialized) as BoardElement[];
		this.store.set(parsed.map((e) => new BoardElement(e.id, e.x, e.y, e.color, e.type)));
	}

	private updateElement(id: string, mutate: (element: BoardElement) => void): void {
		this.store.update((elements) =>
			elements.map((element) => {
				if (element.id === id) {
					mutate(element);
				}
				return element;
			}),
		);
	}
}

export const board = new Board();
