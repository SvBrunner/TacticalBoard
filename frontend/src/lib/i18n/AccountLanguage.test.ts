import { describe, it, expect, beforeEach, vi } from "vitest";
import { writable, get } from "svelte/store";
import type { SessionState } from "$lib/auth/AuthSession";
import { MemoryKeyValueStorage } from "$lib/playback/KeyValueStorage";
import { AccountLanguage } from "./AccountLanguage";
import { I18n } from "./I18n";
import { LocaleRegistry } from "./LocaleRegistry";

const user = (preferredLanguage: string | null, id = "u1") => ({
	id,
	displayName: "Alice",
	isSystemAdministrator: false,
	preferredLanguage,
});

describe("AccountLanguage", () => {
	let i18n: I18n;
	let state: ReturnType<typeof writable<SessionState>>;
	let changeLanguage: ReturnType<typeof vi.fn<(language: string) => Promise<boolean>>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: "info" | "warn" | "error") => void>> };
	let account: AccountLanguage;

	beforeEach(() => {
		i18n = new I18n(LocaleRegistry.bundled(), new MemoryKeyValueStorage());
		state = writable<SessionState>({ status: "unknown" });
		changeLanguage = vi.fn(async (language: string) => {
			const current = get(state);
			if (current.status === "authenticated") {
				state.set({ status: "authenticated", user: { ...current.user, preferredLanguage: language } });
			}
			return true;
		});
		log = { notify: vi.fn() };
		account = new AccountLanguage({
			i18n,
			session: { state, current: () => get(state), changeLanguage },
			log,
		});
		account.attach();
	});

	describe("on login", () => {
		it("the account's language wins", () => {
			i18n.start(["en-US"]);

			state.set({ status: "authenticated", user: user("de") });

			expect(i18n.current()).toBe("de");
		});

		it("an account without a language keeps the browser's", () => {
			i18n.select("de");

			state.set({ status: "authenticated", user: user(null) });

			expect(i18n.current()).toBe("de");
			expect(changeLanguage).not.toHaveBeenCalled();
		});

		it("an account language without translation is ignored", () => {
			state.set({ status: "authenticated", user: user("fr") });

			expect(i18n.current()).toBe("en");
		});

		it("is applied once per login, not on every change of the user (e.g. a new display name)", () => {
			state.set({ status: "authenticated", user: user("de") });
			i18n.select("en");

			state.set({ status: "authenticated", user: { ...user("de"), displayName: "Coach" } });

			expect(i18n.current()).toBe("en");
		});

		it("is applied again after a logout and a new login, also for another user", () => {
			state.set({ status: "authenticated", user: user("de") });
			i18n.select("en");
			state.set({ status: "anonymous" });
			state.set({ status: "authenticated", user: user("de") });
			expect(i18n.current()).toBe("de");

			state.set({ status: "authenticated", user: user("en", "u2") });
			expect(i18n.current()).toBe("en");
		});
	});

	describe("choosing a language", () => {
		it("without login switches and remembers it in the browser only", async () => {
			state.set({ status: "anonymous" });

			await expect(account.choose("de")).resolves.toBe(true);

			expect(i18n.current()).toBe("de");
			expect(changeLanguage).not.toHaveBeenCalled();
		});

		it("when logged in also stores it in the account", async () => {
			state.set({ status: "authenticated", user: user(null) });

			await expect(account.choose("de")).resolves.toBe(true);

			expect(i18n.current()).toBe("de");
			expect(changeLanguage).toHaveBeenCalledWith("de");
		});

		it("doesn't store the account's own language again", async () => {
			state.set({ status: "authenticated", user: user("de") });

			await account.choose("de");

			expect(changeLanguage).not.toHaveBeenCalled();
		});

		it("keeps the language in the browser when the account can't store it", async () => {
			state.set({ status: "authenticated", user: user(null) });
			changeLanguage.mockResolvedValue(false);

			await expect(account.choose("de")).resolves.toBe(false);

			expect(i18n.current()).toBe("de");
			expect(log.notify).toHaveBeenCalledWith(expect.stringContaining("couldn't be stored"), "warn");
		});

		it("refuses a language without translation", async () => {
			await expect(account.choose("fr")).resolves.toBe(false);
			expect(i18n.current()).toBe("en");
		});
	});

	it("stops following the session when detached", () => {
		const other = new AccountLanguage({ i18n, session: { state, current: () => get(state), changeLanguage } });
		const detach = other.attach();
		detach();

		expect(() => state.set({ status: "anonymous" })).not.toThrow();
	});
});
