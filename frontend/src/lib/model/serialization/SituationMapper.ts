import type { BoardElement } from "../elements/BoardElement";
import type { PointElementType } from "../elements/ElementType";
import { PointElement } from "../elements/PointElement";
import type { FieldType } from "../FieldType";
import { Frame } from "../Frame";
import { Situation } from "../Situation";
import type { SportId } from "../Sport";
import type { ElementDto, FrameDto, SituationFileDto } from "./SituationFileDto";
import { CURRENT_FORMAT_VERSION, SITUATION_FILE_FORMAT } from "./SituationFileDto";

/** Converts between the domain model and the file DTO. Expects validated input in `fromDto`. */
export class SituationMapper {
	toDto(situation: Situation): SituationFileDto {
		return {
			format: SITUATION_FILE_FORMAT,
			formatVersion: CURRENT_FORMAT_VERSION,
			situation: {
				id: situation.id,
				title: situation.title,
				description: situation.description,
				sport: situation.sport,
				fieldType: situation.fieldType,
				createdAt: situation.createdAt,
				updatedAt: situation.updatedAt,
				frames: situation.frames.map((frame) => this.frameToDto(frame)),
			},
		};
	}

	fromDto(dto: SituationFileDto): Situation {
		const situation = dto.situation;
		return new Situation({
			id: situation.id,
			title: situation.title,
			description: situation.description,
			sport: situation.sport as SportId,
			fieldType: situation.fieldType as FieldType,
			createdAt: situation.createdAt,
			updatedAt: situation.updatedAt,
			frames: situation.frames.map((frame) => this.frameFromDto(frame)),
		});
	}

	private frameToDto(frame: Frame): FrameDto {
		return {
			id: frame.id,
			description: frame.description,
			elements: frame.elements.map((element) => this.elementToDto(element)),
		};
	}

	private elementToDto(element: BoardElement): ElementDto {
		if (element instanceof PointElement) {
			return {
				id: element.id,
				type: element.type,
				color: element.color,
				x: element.x,
				y: element.y,
				label: element.label,
			};
		}
		throw new Error(`Cannot serialize element ${element.id} of type ${element.type}`);
	}

	private frameFromDto(frame: FrameDto): Frame {
		return new Frame(
			frame.id,
			frame.description,
			frame.elements.map((element) => this.elementFromDto(element)),
		);
	}

	private elementFromDto(element: ElementDto): BoardElement {
		return new PointElement(
			element.id,
			element.x,
			element.y,
			element.color,
			element.type as PointElementType,
			element.label,
		);
	}
}
