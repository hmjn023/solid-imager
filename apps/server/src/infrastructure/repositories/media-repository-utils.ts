import { createMediaSearchFunctions } from "@solid-imager/db/repositories/media-repository-utils";
import { getExecutor } from "~/infrastructure/db/executor";

const mediaSearchFunctions = createMediaSearchFunctions(getExecutor);

export const searchMedia =
	mediaSearchFunctions.searchMedia.bind(mediaSearchFunctions);
export const searchMediaInDirectory =
	mediaSearchFunctions.searchMediaInDirectory.bind(mediaSearchFunctions);
export const globalSearchMedia =
	mediaSearchFunctions.globalSearchMedia.bind(mediaSearchFunctions);
