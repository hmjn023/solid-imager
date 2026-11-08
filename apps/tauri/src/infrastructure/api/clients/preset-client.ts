import type { PresetOrpcLike } from "@solid-imager/core/contract";
import { client } from "~/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: client.presets,
};
