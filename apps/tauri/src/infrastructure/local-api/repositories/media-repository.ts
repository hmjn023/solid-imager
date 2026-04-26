import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export type UpsertTauriMediaInput =
	import("@solid-imager/db/repositories/media-repository").UpsertMediaInput;

export const TauriMediaRepository = createMediaRepository(
	getTauriDrizzleExecutor,
);
