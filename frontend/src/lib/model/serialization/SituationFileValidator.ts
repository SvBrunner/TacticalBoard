import { isElementType } from "../elements/ElementType";
import { isFieldType } from "../FieldType";
import { PositionCatalog } from "../positions/PositionCatalog";
import { isSportId } from "../Sport";
import type { SituationFileDto } from "./SituationFileDto";
import { SITUATION_FILE_FORMAT } from "./SituationFileDto";
import type { ValidationIssue } from "./SituationImportErrors";

type JsonObject = Record<string, unknown>;

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Checks that parsed JSON has the shape of the current situation file format.
 * Collects all issues instead of stopping at the first one. Unknown extra
 * properties are ignored.
 */
export class SituationFileValidator {
	validate(raw: unknown): ValidationIssue[] {
		const issues: ValidationIssue[] = [];
		const report = (path: string, message: string) => issues.push({ path, message });

		if (!isObject(raw)) {
			report("(root)", "expected object");
			return issues;
		}
		if (raw.format !== SITUATION_FILE_FORMAT) {
			report("format", `expected "${SITUATION_FILE_FORMAT}"`);
		}
		if (!isPositiveInteger(raw.formatVersion)) {
			report("formatVersion", "expected positive integer");
		}
		if (!isObject(raw.situation)) {
			report("situation", "expected object");
			return issues;
		}
		this.validateSituation(raw.situation, "situation", report);
		return issues;
	}

	isValid(raw: unknown): raw is SituationFileDto {
		return this.validate(raw).length === 0;
	}

	private validateSituation(situation: JsonObject, path: string, report: Reporter): void {
		checkNonEmptyString(situation.id, `${path}.id`, report);
		checkString(situation.title, `${path}.title`, report);
		checkString(situation.description, `${path}.description`, report);
		if (!isSportId(situation.sport)) {
			report(`${path}.sport`, "expected supported sport");
		}
		if (!isFieldType(situation.fieldType)) {
			report(`${path}.fieldType`, 'expected "full" or "half"');
		}
		checkTimestamp(situation.createdAt, `${path}.createdAt`, report);
		checkTimestamp(situation.updatedAt, `${path}.updatedAt`, report);

		const frames = situation.frames;
		if (!Array.isArray(frames)) {
			report(`${path}.frames`, "expected array");
			return;
		}
		if (frames.length === 0) {
			report(`${path}.frames`, "expected at least one frame");
			return;
		}
		const seenFrameIds = new Set<string>();
		frames.forEach((frame, index) => {
			const framePath = `${path}.frames[${index}]`;
			if (!isObject(frame)) {
				report(framePath, "expected object");
				return;
			}
			if (typeof frame.id === "string" && frame.id !== "") {
				if (seenFrameIds.has(frame.id)) {
					report(`${framePath}.id`, `duplicate frame id "${frame.id}"`);
				}
				seenFrameIds.add(frame.id);
			}
			this.validateFrame(frame, framePath, report);
		});
	}

	private validateFrame(frame: JsonObject, path: string, report: Reporter): void {
		checkNonEmptyString(frame.id, `${path}.id`, report);
		checkString(frame.description, `${path}.description`, report);

		const elements = frame.elements;
		if (!Array.isArray(elements)) {
			report(`${path}.elements`, "expected array");
			return;
		}
		const seenElementIds = new Set<string>();
		elements.forEach((element, index) => {
			const elementPath = `${path}.elements[${index}]`;
			if (!isObject(element)) {
				report(elementPath, "expected object");
				return;
			}
			if (typeof element.id === "string" && element.id !== "") {
				if (seenElementIds.has(element.id)) {
					report(`${elementPath}.id`, `duplicate element id "${element.id}" in frame`);
				}
				seenElementIds.add(element.id);
			}
			this.validateElement(element, elementPath, report);
		});
	}

	private validateElement(element: JsonObject, path: string, report: Reporter): void {
		checkNonEmptyString(element.id, `${path}.id`, report);
		if (!isElementType(element.type)) {
			report(`${path}.type`, "expected known element type");
		}
		checkNonEmptyString(element.color, `${path}.color`, report);
		checkFiniteNumber(element.x, `${path}.x`, report);
		checkFiniteNumber(element.y, `${path}.y`, report);
		if (!PositionCatalog.isValidLabel(element.label)) {
			report(`${path}.label`, "expected string of at most 2 letters or digits");
		}
	}
}

type Reporter = (path: string, message: string) => void;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function checkString(value: unknown, path: string, report: Reporter): void {
	if (typeof value !== "string") {
		report(path, "expected string");
	}
}

function checkNonEmptyString(value: unknown, path: string, report: Reporter): void {
	if (typeof value !== "string" || value === "") {
		report(path, "expected non-empty string");
	}
}

function checkFiniteNumber(value: unknown, path: string, report: Reporter): void {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		report(path, "expected finite number");
	}
}

function checkTimestamp(value: unknown, path: string, report: Reporter): void {
	if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
		report(path, "expected ISO 8601 timestamp");
	}
}
