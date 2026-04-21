import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriTagRepository = createTagRepository(getExecutor, {
	orderByName: true,
	transaction: (callback) =>
		getTauriAppServices().db.transaction((tx) => callback(tx)),
});
