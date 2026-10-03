import { ArrowElement } from "../elements/ArrowElement";
import { ArrowGeometry } from "../elements/ArrowGeometry";
import type { BoardElement } from "../elements/BoardElement";
import { isArrowElementType, type PointElementType } from "../elements/ElementType";
import { PointElement } from "../elements/PointElement";
import type { Point } from "../Point";
import type { FieldType } from "../FieldType";
import { Frame } from "../Frame";
import { Situation } from "../Situation";
import type { SportId } from "../Sport";
import type { ArrowElementDto, ElementDto, FrameDto, PointDto, PointElementDto, SituationFileDto } from "./SituationFileDto";
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
		if (element instanceof ArrowElement) {
			return {
				id: element.id,
				type: element.type,
				color: element.color,
				start: pointToDto(element.start),
				end: pointToDto(element.end),
				bends: element.bends.map(pointToDto),
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
		if (isArrowElementType(element.type)) {
			const arrow = element as ArrowElementDto;
			return new ArrowElement(
				arrow.id,
				element.type,
				arrow.color,
				new ArrowGeometry(pointFromDto(arrow.start), pointFromDto(arrow.end), arrow.bends.map(pointFromDto)),
			);
		}
		const point = element as PointElementDto;
		return new PointElement(point.id, point.x, point.y, point.color, point.type as PointElementType, point.label);
	}
}

function pointToDto(point: Point): PointDto {
	return { x: point.x, y: point.y };
}

/** Only `x` and `y`: extra properties of a point in the file are dropped. */
function pointFromDto(point: PointDto): Point {
	return { x: point.x, y: point.y };
}
