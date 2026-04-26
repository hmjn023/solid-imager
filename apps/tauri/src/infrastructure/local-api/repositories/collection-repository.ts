import { createCollectionRepository } from "@solid-imager/db/repositories/collection-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriCollectionRepository = createCollectionRepository(
	getExecutor,
	{
		orderByName: true,
	},
);
