import type { SituationSummary, StoredSituation } from "$lib/storage/SituationApi";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import type { Situation } from "$lib/model/Situation";

/** A server summary for tests. */
export function summaryOf(overrides: Partial<SituationSummary> = {}): SituationSummary {
	return {
		id: "server-1",
		title: "Powerplay",
		sport: "floorball",
		fieldType: "full",
		folderId: null,
		revision: 1,
		createdAt: "2026-10-04T08:00:00.000Z",
		createdBy: { id: "u1", displayName: "Alice" },
		updatedAt: "2026-10-04T08:00:00.000Z",
		updatedBy: { id: "u1", displayName: "Alice" },
		area: { kind: "personal", id: "u1" },
		canWrite: true,
		...overrides,
	};
}

/**
 * What the server answers for a saved `situation`: its document with the
 * server-owned values stamped in (id, title, timestamps), as the backend does.
 */
export function storedFrom(situation: Situation, overrides: Partial<SituationSummary> = {}): StoredSituation {
	const summary = summaryOf({ fieldType: situation.fieldType, title: situation.displayTitle.trim(), ...overrides });
	const document = new SituationSerializer().toDocument(situation);
	return {
		...summary,
		document: {
			...document,
			situation: {
				...document.situation,
				id: summary.id,
				title: summary.title,
				createdAt: summary.createdAt,
				updatedAt: summary.updatedAt,
			},
		},
	};
}
