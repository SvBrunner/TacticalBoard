/** Discriminator identifying a TacticalBoard situation file. */
export const SITUATION_FILE_FORMAT = "tacticalboard.situation";

/** The format version this app writes. Every format change bumps it and adds a migration. */
export const CURRENT_FORMAT_VERSION = 1;

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

/** The current file shape. */
export type SituationFileDto = SituationFileDtoV1;
