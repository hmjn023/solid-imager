import type { PresetOrpcLike } from "@solid-imager/ui/preset-client";
import { client } from "~/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: client.presets as unknown as PresetOrpcLike["presets"],
};
