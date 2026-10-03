import { FIELD_TYPES, isFieldType, type FieldType } from "$lib/model/FieldType";
import { DEFAULT_SITUATION_TITLE } from "$lib/model/Situation";
import type { NewSituationInput } from "./SituationEditor";

export interface FieldTypeOption {
	readonly value: FieldType;
	readonly label: string;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = { full: "Full field", half: "Half field" };

/**
 * State of the "New situation" form: its inputs (reactive, bindable), their
 * defaults, validation, and conversion into the editor's input. A blank
 * title is allowed; the editor stores it as the default title.
 */
export class NewSituationForm {
	static readonly DEFAULT_FIELD_TYPE: FieldType = "full";
	static readonly fieldTypeOptions: readonly FieldTypeOption[] = FIELD_TYPES.map((value) => ({
		value,
		label: FIELD_TYPE_LABELS[value],
	}));
	/** Shown in the empty title field: what a blank title becomes. */
	static readonly titlePlaceholder = DEFAULT_SITUATION_TITLE;

	title = $state("");
	fieldType = $state<FieldType>(NewSituationForm.DEFAULT_FIELD_TYPE);

	/** Back to the defaults: empty title, full field. */
	reset(): void {
		this.title = "";
		this.fieldType = NewSituationForm.DEFAULT_FIELD_TYPE;
	}

	get isValid(): boolean {
		return isFieldType(this.fieldType);
	}

	/**
	 * The editor input: the title without surrounding whitespace, and the
	 * field type.
	 * @throws Error when the form is invalid.
	 */
	toInput(): NewSituationInput {
		if (!this.isValid) {
			throw new Error(`Invalid field type: ${String(this.fieldType)}`);
		}
		return { title: this.title.trim(), fieldType: this.fieldType };
	}
}
