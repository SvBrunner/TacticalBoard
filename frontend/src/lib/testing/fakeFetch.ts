import type { FetchFunction } from "$lib/api/ApiClient";

/** One recorded request of a `FakeFetch`. */
export interface RecordedRequest {
	readonly url: string;
	readonly method: string;
	readonly headers: Record<string, string>;
	readonly body: string | undefined;
	readonly credentials: RequestCredentials | undefined;
}

type Responder = (request: RecordedRequest) => Response | Promise<Response>;

/** A JSON response (`application/json`, or `application/problem+json` for problems). */
export function jsonResponse(status: number, body: unknown, contentType = "application/json"): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": contentType } });
}

/** A Problem Details response. */
export function problemResponse(status: number, problem: Record<string, unknown>): Response {
	return jsonResponse(status, { status, ...problem }, "application/problem+json");
}

/**
 * A scripted `fetch`: answers each request with the first matching
 * responder (by method + path) and records every request.
 */
export class FakeFetch {
	readonly requests: RecordedRequest[] = [];
	private readonly routes: { method: string; path: string; respond: Responder }[] = [];

	/** Answers `method path` with `respond` (every time, or until replaced by a later `on`). */
	on(method: string, path: string, respond: Responder | Response): this {
		const responder: Responder = typeof respond === "function" ? respond : () => respond.clone();
		this.routes.unshift({ method, path, respond: responder });
		return this;
	}

	/** Every request to `method path` fails with a network error. */
	failOn(method: string, path: string): this {
		return this.on(method, path, () => {
			throw new TypeError("Failed to fetch");
		});
	}

	readonly fetch: FetchFunction = async (input, init) => {
		const request: RecordedRequest = {
			url: input,
			method: init?.method ?? "GET",
			headers: { ...(init?.headers as Record<string, string> | undefined) },
			body: typeof init?.body === "string" ? init.body : undefined,
			credentials: init?.credentials,
		};
		this.requests.push(request);
		const route = this.routes.find((candidate) => candidate.method === request.method && candidate.path === request.url);
		if (!route) {
			return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
		}
		return route.respond(request);
	};

	/** The requests to `path`. */
	requestsTo(path: string): RecordedRequest[] {
		return this.requests.filter((request) => request.url === path);
	}
}

export const ANTIFORGERY = { token: "token-1", headerName: "X-CSRF-TOKEN", formFieldName: "__RequestVerificationToken" };
