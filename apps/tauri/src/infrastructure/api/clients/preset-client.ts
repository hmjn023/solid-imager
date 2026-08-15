import type { PresetOrpcLike } from "@solid-imager/core/domain/contract/presets-client";
import { client } from "~/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: client.presets,
};
