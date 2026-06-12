import type { PresetOrpcLike } from "@solid-imager/ui/preset-client";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: orpc.presets,
};
