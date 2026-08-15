import type { PresetOrpcLike } from "@solid-imager/core/domain/contract/presets-client";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: orpc.presets,
};
