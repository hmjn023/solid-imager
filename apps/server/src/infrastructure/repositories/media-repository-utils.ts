import { createMediaSearchFunctions } from "@solid-imager/db/repositories/media-repository-utils";
import { getExecutor } from "~/infrastructure/db/executor";

export const { searchMedia, searchMediaInDirectory, globalSearchMedia } =
	createMediaSearchFunctions(getExecutor);
