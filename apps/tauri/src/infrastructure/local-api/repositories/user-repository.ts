import { createUserRepository } from "@solid-imager/db/repositories/user-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriUserRepository = createUserRepository(getExecutor, {
	orderByName: true,
});
