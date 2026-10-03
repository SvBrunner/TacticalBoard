/** Discriminator identifying a TacticalBoard situation file. */
export const SITUATION_FILE_FORMAT = "tacticalboard.situation";

/** The format version this app writes. Every format change bumps it and adds a migration. */
export const CURRENT_FORMAT_VERSION = 2;

export interface ElementDtoV1 {
	id: string;
	type: string;
	color: string;
	x: number;
	y: number;
}

export interface FrameDtoV1 {
	id: string;
	description: string;
	elements: ElementDtoV1[];
}

export interface SituationDtoV1 {
	id: string;
	title: string;
	description: string;
	sport: string;
	fieldType: string;
	createdAt: string;
	updatedAt: string;
	frames: FrameDtoV1[];
}

export interface SituationFileDtoV1 {
	format: typeof SITUATION_FILE_FORMAT;
	formatVersion: 1;
	situation: SituationDtoV1;
}

/** Version 2: elements have a position `label` ("" = no label). */
export interface ElementDtoV2 extends ElementDtoV1 {
	label: string;
}

export interface FrameDtoV2 extends Omit<FrameDtoV1, "elements"> {
	elements: ElementDtoV2[];
}

export interface SituationDtoV2 extends Omit<SituationDtoV1, "frames"> {
	frames: FrameDtoV2[];
}

export interface SituationFileDtoV2 {
	format: typeof SITUATION_FILE_FORMAT;
	formatVersion: 2;
	situation: SituationDtoV2;
}

/** The current file shape. */
export type SituationFileDto = SituationFileDtoV2;
export type SituationDto = SituationDtoV2;
export type FrameDto = FrameDtoV2;
export type ElementDto = ElementDtoV2;
