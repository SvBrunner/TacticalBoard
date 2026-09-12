import { writable, type Readable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";

export type NotificationLevel = "info" | "warn" | "error";

export interface Notification {
	readonly id: string;
	readonly message: string;
	readonly level: NotificationLevel;
}

const DEFAULT_DURATION_MS = 4000;

export class NotificationCenter {
	private readonly store = writable<Notification[]>([]);
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	readonly notifications: Readable<Notification[]> = { subscribe: this.store.subscribe };

	notify(message: string, level: NotificationLevel = "info", durationMs = DEFAULT_DURATION_MS): string {
		const id = uuidv4();
		this.store.update((current) => [...current, { id, message, level }]);
		this.timers.set(
			id,
			setTimeout(() => this.dismiss(id), durationMs),
		);
		return id;
	}

	dismiss(id: string): void {
		const timer = this.timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
		this.store.update((current) => current.filter((n) => n.id !== id));
	}

	clear(): void {
		this.timers.forEach((timer) => clearTimeout(timer));
		this.timers.clear();
		this.store.set([]);
	}
}

export const notifications = new NotificationCenter();
