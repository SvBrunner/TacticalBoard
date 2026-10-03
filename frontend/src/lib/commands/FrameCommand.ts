import type { Command } from "$lib/history/Command";
import type { Frame } from "$lib/model/Frame";

/** A command acting on one frame. Elements are always addressed by id, never by reference or index. */
export type FrameCommand = Command<Frame>;
