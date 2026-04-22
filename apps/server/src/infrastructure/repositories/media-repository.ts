import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export type UpsertTauriMediaInput =
	import("@solid-imager/db/repositories/media-repository").UpsertMediaInput;

export const MediaRepository = createMediaRepository(
	(tx) => (tx ?? db) as DrizzleExecutor,
);
