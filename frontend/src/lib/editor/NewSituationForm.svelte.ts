import { FIELD_TYPES, isFieldType, type FieldType } from "$lib/model/FieldType";
import type { NewSituationInput } from "./SituationEditor";

/** A field type choice; its name in the UI is `messages.situation.fieldTypes[value]`. */
export interface FieldTypeOption {
	readonly value: FieldType;
}

/**
 * State of the "New situation" form: its inputs (reactive, bindable), their
 * defaults, validation, and conversion into the editor's input. A blank
 * title is allowed; it becomes the default title of the UI language
 * (arc42 ch. 8.18), which the form shows as the title's placeholder.
 */
export class NewSituationForm {
	static readonly DEFAULT_FIELD_TYPE: FieldType = "full";
	static readonly fieldTypeOptions: readonly FieldTypeOption[] = FIELD_TYPES.map((value) => ({ value }));

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
	 * The editor input: the title without surrounding whitespace (a blank one
	 * becomes `defaultTitle`, the default title of the UI language), and the
	 * field type.
	 * @throws Error when the form is invalid.
	 */
	toInput(defaultTitle: string): NewSituationInput {
		if (!this.isValid) {
			throw new Error(`Invalid field type: ${String(this.fieldType)}`);
		}
		const title = this.title.trim();
		return { title: title === "" ? defaultTitle : title, fieldType: this.fieldType };
	}
}
