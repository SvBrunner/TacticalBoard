/** Discriminator identifying a TacticalBoard situation file. */
export const SITUATION_FILE_FORMAT = "tacticalboard.situation";

/** The format version this app writes. Every format change bumps it and adds a migration. */
export const CURRENT_FORMAT_VERSION = 3;

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

export interface PointDtoV3 {
	x: number;
	y: number;
}

/** Version 3: point elements are unchanged from version 2. */
export type PointElementDtoV3 = ElementDtoV2;

/**
 * Version 3: arrows (`Pass`, `Run`, `Shot`). No `x`/`y`/`label`; the curve
 * runs from `start` through the `bends` (in order) to `end`.
 */
export interface ArrowElementDtoV3 {
	id: string;
	type: string;
	color: string;
	start: PointDtoV3;
	end: PointDtoV3;
	bends: PointDtoV3[];
}

export type ElementDtoV3 = PointElementDtoV3 | ArrowElementDtoV3;

export interface FrameDtoV3 extends Omit<FrameDtoV2, "elements"> {
	elements: ElementDtoV3[];
}

export interface SituationDtoV3 extends Omit<SituationDtoV2, "frames"> {
	frames: FrameDtoV3[];
}

export interface SituationFileDtoV3 {
	format: typeof SITUATION_FILE_FORMAT;
	formatVersion: 3;
	situation: SituationDtoV3;
}

/** The current file shape. */
export type SituationFileDto = SituationFileDtoV3;
export type SituationDto = SituationDtoV3;
export type FrameDto = FrameDtoV3;
export type ElementDto = ElementDtoV3;
export type PointElementDto = PointElementDtoV3;
export type ArrowElementDto = ArrowElementDtoV3;
export type PointDto = PointDtoV3;
