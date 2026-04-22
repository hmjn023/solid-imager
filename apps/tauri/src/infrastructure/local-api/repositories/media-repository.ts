import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export type UpsertTauriMediaInput =
	import("@solid-imager/db/repositories/media-repository").UpsertMediaInput;

export const TauriMediaRepository = createMediaRepository(getExecutor);
