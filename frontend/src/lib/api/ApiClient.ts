/** An RFC 7807 problem as the backend sends it (arc42 ch. 8.2). */
export interface ProblemDetails {
	readonly type?: string;
	readonly title?: string;
	readonly status?: number;
	readonly detail?: string;
	/** Validation errors per field (problem type `validation-failed`). */
	readonly errors?: Readonly<Record<string, readonly string[]>>;
}

/** The backend answered with an error (a Problem Details body, if it sent one). */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly problem: ProblemDetails | null,
	) {
		super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`);
		this.name = "ApiError";
	}

	/** The problem type URI, e.g. `https://tacticalboard/errors/validation-failed`. */
	get type(): string | undefined {
		return this.problem?.type;
	}

	/** The first validation message for `field`, if any. */
	fieldError(field: string): string | undefined {
		return this.problem?.errors?.[field]?.[0];
	}
}

/**
 * The backend can't be reached, or something other than the backend answered
 * (e.g. the dev server without a backend behind its proxy). Callers treat this
 * as "no server": local mode keeps working.
 */
export class ApiUnavailableError extends Error {
	constructor(message = "The server is not reachable.") {
		super(message);
		this.name = "ApiUnavailableError";
	}
}

/** What `GET /api/antiforgery` returns: the token and where to send it. */
export interface AntiforgeryToken {
	readonly token: string;
	readonly headerName: string;
	readonly formFieldName: string;
}

export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

export type MutatingMethod = "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Talks to the backend's REST API on the same origin (the session cookie goes
 * along automatically). State-changing requests carry the antiforgery token
 * (arc42 ch. 8.13), fetched once and cached; a request rejected because the
 * token went stale (e.g. after a login or logout in another tab) is retried
 * once with a fresh token.
 */
export class ApiClient {
	static readonly ANTIFORGERY_PATH = "/api/antiforgery";
	static readonly INVALID_ANTIFORGERY_TOKEN = "https://tacticalboard/errors/invalid-antiforgery-token";

	private antiforgery: Promise<AntiforgeryToken> | null = null;

	constructor(private readonly fetchFn: FetchFunction = (input, init) => fetch(input, init)) {}

	/** `GET path`, parsed as JSON. */
	get<T>(path: string): Promise<T> {
		return this.request<T>(path, { method: "GET" });
	}

	/** A state-changing request with a JSON body and the antiforgery header. */
	async send<T>(method: MutatingMethod, path: string, body?: unknown): Promise<T> {
		try {
			return await this.sendOnce<T>(method, path, body);
		} catch (error) {
			if (!(error instanceof ApiError && error.type === ApiClient.INVALID_ANTIFORGERY_TOKEN)) {
				throw error;
			}
			this.forgetAntiforgeryToken();
			return this.sendOnce<T>(method, path, body);
		}
	}

	/** The antiforgery token of the current session (cached until forgotten or rejected). */
	antiforgeryToken(): Promise<AntiforgeryToken> {
		if (!this.antiforgery) {
			const pending = this.get<AntiforgeryToken>(ApiClient.ANTIFORGERY_PATH);
			this.antiforgery = pending;
			pending.catch(() => {
				if (this.antiforgery === pending) {
					this.antiforgery = null;
				}
			});
		}
		return this.antiforgery;
	}

	/** Drops the cached token, e.g. when the session changed. */
	forgetAntiforgeryToken(): void {
		this.antiforgery = null;
	}

	private async sendOnce<T>(method: MutatingMethod, path: string, body: unknown): Promise<T> {
		const { token, headerName } = await this.antiforgeryToken();
		const headers: Record<string, string> = { [headerName]: token };
		const init: RequestInit = { method, headers };
		if (body !== undefined) {
			headers["Content-Type"] = "application/json";
			init.body = JSON.stringify(body);
		}
		return this.request<T>(path, init);
	}

	private async request<T>(path: string, init: RequestInit): Promise<T> {
		let response: Response;
		try {
			response = await this.fetchFn(path, {
				...init,
				credentials: "same-origin",
				headers: { Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
			});
		} catch {
			throw new ApiUnavailableError();
		}

		const json = ApiClient.isJson(response);
		if (!response.ok) {
			if (!json) {
				throw new ApiUnavailableError(`The server answered ${response.status} without an API response.`);
			}
			throw new ApiError(response.status, await ApiClient.readJson<ProblemDetails>(response));
		}
		if (response.status === 204) {
			return undefined as T;
		}
		if (!json) {
			throw new ApiUnavailableError("The server did not answer with JSON.");
		}
		const value = await ApiClient.readJson<T>(response);
		if (value === null) {
			throw new ApiUnavailableError("The server sent an unreadable answer.");
		}
		return value;
	}

	private static isJson(response: Response): boolean {
		const type = response.headers.get("Content-Type") ?? "";
		return /^application\/(problem\+)?json\b/i.test(type);
	}

	private static async readJson<T>(response: Response): Promise<T | null> {
		try {
			return (await response.json()) as T;
		} catch {
			return null;
		}
	}
}
