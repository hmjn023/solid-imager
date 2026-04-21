import { createIpRepository } from "@solid-imager/db/repositories/ip-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriIpRepository = createIpRepository(getExecutor, {
	orderByName: true,
});
