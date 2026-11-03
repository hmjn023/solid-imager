import type { PresetOrpcLike } from "@solid-imager/core/contract";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: orpc.presets,
};
