import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriSourceRepository = createSourceRepository(getExecutor, {
	orderByName: true,
});
