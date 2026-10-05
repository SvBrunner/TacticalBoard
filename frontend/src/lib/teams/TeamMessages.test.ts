import { describe, it, expect } from "vitest";
import { ApiError, ApiUnavailableError, type FieldErrorCode } from "$lib/api/ApiClient";
import { de, en } from "$lib/testing/i18n";
import { TeamApi } from "./TeamApi";
import { TeamMessages } from "./TeamMessages";

const fallback = () => "Fallback.";
const validation = (fieldErrors: Record<string, FieldErrorCode[]>) =>
	new ApiError(400, {
		type: "https://tacticalboard/errors/validation-failed",
		fieldErrors,
	});

describe("TeamMessages", () => {
	it("words a taken name with the name", () => {
		const error = new ApiError(409, { type: TeamApi.DUPLICATE_NAME });

		expect(TeamMessages.forChange(error, "Lions", fallback)(en)).toBe("A team named “Lions” already exists. Choose another name.");
		expect(TeamMessages.forChange(error, "Lions", fallback)(de)).toBe("Ein Team namens „Lions“ existiert bereits. Wähle einen anderen Namen.");
	});

	it("words a team that is gone", () => {
		const error = new ApiError(404, { type: TeamApi.NOT_FOUND });

		expect(TeamMessages.forChange(error, "Lions", fallback)(en)).toBe("This team no longer exists.");
		expect(TeamMessages.forLogo(error, fallback)(en)).toBe("This team no longer exists.");
	});

	it("words the name's and the logo's problems as sentences", () => {
		const error = validation({
			name: [{ code: "too-long", maxLength: 64 }],
			logo: [{ code: "unsupported-image" }],
		});

		expect(TeamMessages.forChange(error, "x", fallback)(en)).toBe("The name must be at most 64 characters long. The logo must be a PNG, JPEG or WebP image.");
		expect(TeamMessages.forLogo(validation({ logo: [{ code: "file-too-large", maxBytes: 5242880 }] }), fallback)(de)).toBe(
			"Das Logo darf höchstens 5 MB groß sein.",
		);
	});

	it("falls back to the general wording", () => {
		expect(TeamMessages.forChange(new ApiUnavailableError(), "x", fallback)(en)).toBe("The server is not reachable. Please try again later.");
		expect(TeamMessages.forChange(new ApiError(500, {}), "x", fallback)(en)).toBe("Fallback.");
		expect(TeamMessages.forLogo(new ApiError(403, { type: "https://tacticalboard/errors/forbidden" }), fallback)(en)).toBe("You may not do this.");
		expect(TeamMessages.general(new TypeError("x"), fallback)(en)).toBe("Fallback.");
	});

	it("knows an ended session", () => {
		expect(TeamMessages.isSessionEnded(new ApiError(401, null))).toBe(true);
		expect(TeamMessages.isSessionEnded(new ApiError(403, null))).toBe(false);
	});

	it.each<[string, string, "leave" | "change", string, string]>([
		[
			"the last Admin leaving",
			TeamApi.LAST_ADMIN,
			"leave",
			"You're the last Admin of “Lions”. Make another member Admin first, or delete the team.",
			"Du bist der letzte Admin von „Lions“. Mache zuerst ein anderes Mitglied zum Admin oder lösche das Team.",
		],
		[
			"the last Admin changed",
			TeamApi.LAST_ADMIN,
			"change",
			"“Lions” needs at least one Admin. Make another member Admin first.",
			"„Lions“ braucht mindestens einen Admin. Mache zuerst ein anderes Mitglied zum Admin.",
		],
		["a member gone", TeamApi.MEMBER_NOT_FOUND, "change", "This person is no longer a member of the team.", "Diese Person ist kein Mitglied des Teams mehr."],
		[
			"a request decided",
			TeamApi.JOIN_REQUEST_NOT_FOUND,
			"change",
			"This request was already decided or no longer exists.",
			"Über diese Anfrage wurde schon entschieden oder es gibt sie nicht mehr.",
		],
		[
			"a pending request",
			TeamApi.JOIN_REQUEST_PENDING,
			"change",
			"You've already asked to join this team. An Admin will accept or reject your request.",
			"Du hast den Beitritt zu diesem Team schon angefragt. Ein Admin nimmt deine Anfrage an oder lehnt sie ab.",
		],
		["already a member", TeamApi.ALREADY_MEMBER, "change", "You're already a member of this team.", "Du bist bereits Mitglied dieses Teams."],
		["the team gone", TeamApi.NOT_FOUND, "leave", "This team no longer exists.", "Dieses Team existiert nicht mehr."],
	])("words membership failures: %s", (_name, type, action, english, german) => {
		const message = TeamMessages.forMembership(new ApiError(409, { type }), "Lions", action, fallback);

		expect(message(en)).toBe(english);
		expect(message(de)).toBe(german);
	});

	it("falls back for other membership failures", () => {
		expect(TeamMessages.forMembership(new ApiError(500, {}), "Lions", "change", fallback)(en)).toBe("Fallback.");
		expect(TeamMessages.forMembership(new ApiUnavailableError(), "Lions", "change", fallback)(en)).toBe("The server is not reachable. Please try again later.");
	});

	it("knows when the user lost their rights", () => {
		expect(TeamMessages.isAccessLost(new ApiError(403, { type: TeamApi.FORBIDDEN }))).toBe(true);
		expect(TeamMessages.isAccessLost(new ApiError(403, {}))).toBe(true);
		expect(TeamMessages.isAccessLost(new ApiError(409, { type: TeamApi.LAST_ADMIN }))).toBe(false);
		expect(TeamMessages.isAccessLost(new Error("x"))).toBe(false);
	});
});
